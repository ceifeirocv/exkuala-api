import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { createId } from '@paralleldrive/cuid2';
import { OrganizerEntity, OrganizerStatus } from './organizer.entity';
import { OrganizerAuditLogEntity, OrganizerAuditAction } from './organizer-audit-log.entity';
import { CreateOrganizerDto } from './dto/create-organizer.dto';
import { OrganizerPublicResponseDto } from './dto/organizer-public-response.dto';
import { OrganizerSelfResponseDto } from './dto/organizer-self-response.dto';

@Injectable()
export class OrganizersService {
  private readonly logger = new Logger(OrganizersService.name);

  constructor(
    @InjectRepository(OrganizerEntity)
    private readonly organizerRepository: Repository<OrganizerEntity>,
    @InjectRepository(OrganizerAuditLogEntity)
    private readonly auditLogRepository: Repository<OrganizerAuditLogEntity>,
  ) {}

  // apply() — state-aware submission (D-05, D-06, D-07).
  // APPROVED → 409 (terminal, D-07). PENDING → 409 (duplicate). REJECTED → overwrite in-place (D-06).
  // No row → create new pending row. Catches PG 23505 as fallback for any concurrent race.
  async apply(userId: string, dto: CreateOrganizerDto): Promise<OrganizerSelfResponseDto> {
    const existing = await this.organizerRepository.findOne({ where: { userId } });
    if (existing) {
      if (existing.status === OrganizerStatus.APPROVED) {
        throw new ConflictException(
          `Organizer is already ${existing.status} — transition to ${OrganizerStatus.PENDING} is not allowed`,
        );
      }
      if (existing.status === OrganizerStatus.PENDING) {
        throw new ConflictException(
          `An organizer application already exists with status ${existing.status}`,
        );
      }
      // status === REJECTED — reapply in-place (D-06): overwrite fields, reset to pending
      existing.name = dto.name;
      existing.description = dto.description;
      existing.email = dto.email;
      existing.website = dto.website ?? null;
      existing.socialLinks = dto.socialLinks ?? null;
      existing.status = OrganizerStatus.PENDING;
      const saved = await this.organizerRepository.save(existing);
      return this.toSelfResponse(saved, null);
    }

    const entity = this.organizerRepository.create({
      id: createId(),
      userId,
      ...dto,
      website: dto.website ?? null,
      socialLinks: dto.socialLinks ?? null,
      status: OrganizerStatus.PENDING,
    });
    try {
      const saved = await this.organizerRepository.save(entity);
      return this.toSelfResponse(saved, null);
    } catch (err) {
      if (
        err instanceof QueryFailedError &&
        (err as QueryFailedError & { code: string }).code === '23505'
      ) {
        throw new ConflictException(`An organizer application already exists for this user`);
      }
      this.logger.error({ event: 'organizer_apply_failed', userId, error: (err as Error).message });
      throw err;
    }
  }

  // approve() — transitions pending → approved and inserts an immutable audit log row.
  // Sequential saves (not transactional) per RESEARCH.md open question 3 for Phase 5.
  // TODO: wrap in a transaction in a future phase if audit reliability becomes a hard requirement.
  async approve(id: string, note?: string): Promise<void> {
    const organizer = await this.findOrganizerOrThrow(id);
    this.assertTransitionAllowed(organizer.status, OrganizerStatus.APPROVED);
    organizer.status = OrganizerStatus.APPROVED;
    await this.organizerRepository.save(organizer);
    // id pre-generated explicitly — repository.insert() skips @BeforeInsert (RESEARCH.md anti-pattern)
    const log = this.auditLogRepository.create({
      id: createId(),
      organizerId: id,
      action: OrganizerAuditAction.APPROVED,
      note: note ?? null,
    });
    await this.auditLogRepository.save(log);
  }

  // reject() — transitions pending → rejected with optional note; inserts audit log row.
  // Symmetric to approve(). Sequential saves per Phase 5 scope.
  async reject(id: string, note?: string): Promise<void> {
    const organizer = await this.findOrganizerOrThrow(id);
    this.assertTransitionAllowed(organizer.status, OrganizerStatus.REJECTED);
    organizer.status = OrganizerStatus.REJECTED;
    await this.organizerRepository.save(organizer);
    const log = this.auditLogRepository.create({
      id: createId(),
      organizerId: id,
      action: OrganizerAuditAction.REJECTED,
      note: note ?? null,
    });
    await this.auditLogRepository.save(log);
  }

  // findApprovedById() — used by GET /organizers/:id (public profile).
  // Throws 404 if organizer does not exist OR status is not approved (D-03).
  // Returns the entity; callers use toPublicResponse() to get the public DTO (email excluded).
  async findApprovedById(id: string): Promise<OrganizerEntity> {
    const organizer = await this.organizerRepository.findOne({
      where: { id },
    });
    if (!organizer || organizer.status !== OrganizerStatus.APPROVED) {
      throw new NotFoundException(`Organizer with id '${id}' not found`);
    }
    return organizer;
  }

  // findSelfWithLatestNote() — used by GET /organizers/me (self-view, D-04, D-15).
  // Returns all fields + latest rejection note from audit log.
  // Returns null for latestRejectionNote when status is approved (D-15).
  async findSelfWithLatestNote(userId: string): Promise<OrganizerSelfResponseDto> {
    const organizer = await this.organizerRepository.findOne({ where: { userId } });
    if (!organizer) {
      throw new NotFoundException(`No organizer application found for this user`);
    }
    // Only surface rejection note when status is rejected per D-15
    if (organizer.status === OrganizerStatus.APPROVED) {
      return this.toSelfResponse(organizer, null);
    }
    const latestRejection = await this.auditLogRepository.findOne({
      where: { organizerId: organizer.id, action: OrganizerAuditAction.REJECTED },
      order: { createdAt: 'DESC' },
    });
    return this.toSelfResponse(organizer, latestRejection?.note ?? null);
  }

  // findByStatus() — used by GET /admin/organizers?status= (D-12).
  // Returns all organizers when status param is absent (RESEARCH.md open question 1 resolution).
  async findByStatus(status?: OrganizerStatus): Promise<OrganizerPublicResponseDto[]> {
    const organizers = await this.organizerRepository.find(
      status ? { where: { status } } : undefined,
    );
    return organizers.map((org) => this.toPublicResponse(org));
  }

  // findAuditHistory() — used by GET /admin/organizers/:id/history (D-14).
  // Returns all audit log rows for the organizer, newest first.
  async findAuditHistory(organizerId: string): Promise<OrganizerAuditLogEntity[]> {
    return this.auditLogRepository.find({
      where: { organizerId },
      order: { createdAt: 'DESC' },
    });
  }

  // findApprovedByUserId() — used by OrganizerGuard.
  // Returns null (does NOT throw) when user has no approved organizer profile.
  async findApprovedByUserId(userId: string): Promise<OrganizerEntity | null> {
    return this.organizerRepository.findOne({
      where: { userId, status: OrganizerStatus.APPROVED },
    });
  }

  // toPublicResponse() — manual mapping; email intentionally excluded per D-03.
  // Avoids global ClassSerializerInterceptor side effects (RESEARCH.md Pattern 9).
  toPublicResponse(org: OrganizerEntity): OrganizerPublicResponseDto {
    return {
      id: org.id,
      name: org.name,
      description: org.description,
      website: org.website,
      socialLinks: org.socialLinks,
      // email intentionally excluded per D-03
    };
  }

  // assertTransitionAllowed() — validates state machine transitions before any DB write (D-05).
  // APPROVED is terminal — no allowed transitions out of it.
  private assertTransitionAllowed(current: OrganizerStatus, target: OrganizerStatus): void {
    const allowed: Partial<Record<OrganizerStatus, OrganizerStatus[]>> = {
      [OrganizerStatus.PENDING]: [OrganizerStatus.APPROVED, OrganizerStatus.REJECTED],
      [OrganizerStatus.REJECTED]: [OrganizerStatus.PENDING],
      // APPROVED has no allowed transitions — terminal state per D-05
    };
    if (!allowed[current]?.includes(target)) {
      throw new ConflictException(
        `Organizer is already ${current} — transition to ${target} is not allowed`,
      );
    }
  }

  private async findOrganizerOrThrow(id: string): Promise<OrganizerEntity> {
    const organizer = await this.organizerRepository.findOne({ where: { id } });
    if (!organizer) {
      throw new NotFoundException(`Organizer with id '${id}' not found`);
    }
    return organizer;
  }

  private toSelfResponse(org: OrganizerEntity, latestRejectionNote: string | null): OrganizerSelfResponseDto {
    return {
      id: org.id,
      userId: org.userId,
      name: org.name,
      description: org.description,
      email: org.email,
      website: org.website,
      socialLinks: org.socialLinks,
      status: org.status,
      createdAt: org.createdAt,
      updatedAt: org.updatedAt,
      latestRejectionNote,
    };
  }
}
