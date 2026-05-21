# Graph Report - exkuala-api  (2026-05-10)

## Corpus Check
- 92 files · ~76,149 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 400 nodes · 752 edges · 22 communities (15 shown, 7 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 34 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `bf1ff0a2`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Organizer Access Control|Organizer Access Control]]
- [[_COMMUNITY_Categories CRUD Layer|Categories CRUD Layer]]
- [[_COMMUNITY_App Bootstrap & Core|App Bootstrap & Core]]
- [[_COMMUNITY_Users & Webhook Processing|Users & Webhook Processing]]
- [[_COMMUNITY_Auth Types & Config|Auth Types & Config]]
- [[_COMMUNITY_JWT Auth Guards|JWT Auth Guards]]
- [[_COMMUNITY_Module Registry|Module Registry]]
- [[_COMMUNITY_Categories Specs & Seeds|Categories Specs & Seeds]]
- [[_COMMUNITY_JWT Strategy & Decorators|JWT Strategy & Decorators]]
- [[_COMMUNITY_Coverage Report Sorter|Coverage Report Sorter]]
- [[_COMMUNITY_Organizer Admin DTOs|Organizer Admin DTOs]]
- [[_COMMUNITY_Coverage Prettify|Coverage Prettify]]
- [[_COMMUNITY_Coverage Block Nav|Coverage Block Nav]]
- [[_COMMUNITY_Baseline Migration|Baseline Migration]]
- [[_COMMUNITY_Categories Migration|Categories Migration]]
- [[_COMMUNITY_Organizers Migration|Organizers Migration]]
- [[_COMMUNITY_ESLint Config (file)|ESLint Config (file)]]
- [[_COMMUNITY_ESLint Config (node)|ESLint Config (node)]]
- [[_COMMUNITY_Project Guidelines|Project Guidelines]]
- [[_COMMUNITY_Community 21|Community 21]]

## God Nodes (most connected - your core abstractions)
1. `EventsService` - 28 edges
2. `OrganizersService` - 21 edges
3. `UsersService` - 15 edges
4. `UserEntity` - 13 edges
5. `CategoriesService` - 13 edges
6. `OrganizerEntity` - 12 edges
7. `EventsController` - 10 edges
8. `EventEntity` - 10 edges
9. `OrganizersService` - 10 edges
10. `WebhookController` - 9 edges

## Surprising Connections (you probably didn't know these)
- `AppModule` --conceptually_related_to--> `NestJS Framework`  [INFERRED]
  src/app.module.ts → README.md
- `AuthenticatedUser` --semantically_similar_to--> `UserEntity`  [INFERRED] [semantically similar]
  src/types/auth.ts → src/users/user.entity.ts
- `OrganizerEntity` --references--> `UserEntity`  [INFERRED]
  src/organizers/organizer.entity.ts → src/users/user.entity.ts
- `JwtStrategy` --conceptually_related_to--> `EnvironmentVariables / validate`  [INFERRED]
  src/auth/strategies/jwt.strategy.ts → src/config/env.validation.ts
- `Baseline1745000000000` --conceptually_related_to--> `EventEntity`  [INFERRED]
  src/database/migrations/1745000000000-baseline.ts → src/events/event.entity.ts

## Communities (22 total, 7 thin omitted)

### Community 0 - "Organizer Access Control"
Cohesion: 0.07
Nodes (14): DummyController, ApproveOrganizerDto, CreateOrganizerDto, OrganizerPublicResponseDto, OrganizerSelfResponseDto, RejectOrganizerDto, OrganizerGuard, AdminOrganizersController (+6 more)

### Community 1 - "Categories CRUD Layer"
Cohesion: 0.07
Nodes (14): AuthModule, CategoriesController, CategoriesModule, CategoriesService, CategoryEntity, CategoryTranslationEntity, EnvironmentVariables, validate() (+6 more)

### Community 2 - "App Bootstrap & Core"
Cohesion: 0.07
Nodes (16): Public(), Auth0WebhookDto, JwtAuthGuard, OptionalJwtAuthGuard, FakeJwtError, RolesGuard, JwtStrategy, UserEntitySpec (+8 more)

### Community 3 - "Users & Webhook Processing"
Cohesion: 0.1
Nodes (16): CreateEventDto, EventPaginationQueryDto, EventResponseDto, PaginatedEventsResponseDto, PaginatedPublicEventsResponseDto, PublicEventDetailDto, PublicEventListItemDto, PublicEventsQueryDto (+8 more)

### Community 4 - "Auth Types & Config"
Cohesion: 0.09
Nodes (33): AppController.getHello, AppController spec, AppModule, AppService.getHello, Auth0WebhookDto, AuthModule, AuthenticatedUser type, CurrentOrganizer param decorator (+25 more)

### Community 5 - "JWT Auth Guards"
Cohesion: 0.15
Nodes (24): AdminOrganizersController (spec), AppDataSource, Baseline1745000000000 migration, CategoriesController, CategoriesController (spec), CategoriesModule, categories seed script, CategoriesService (+16 more)

### Community 7 - "Categories Specs & Seeds"
Cohesion: 0.27
Nodes (11): addSortIndicators(), enableUI(), getNthColumn(), getTable(), getTableBody(), getTableHeader(), loadColumns(), loadData() (+3 more)

### Community 8 - "JWT Strategy & Decorators"
Cohesion: 0.14
Nodes (13): code:bash ($ pnpm install), code:bash (# development), code:bash (# unit tests), code:bash ($ pnpm install -g @nestjs/mau), Compile and run the project, Deployment, Description, License (+5 more)

### Community 9 - "Coverage Report Sorter"
Cohesion: 0.31
Nodes (13): AdminOrganizersController, ApproveOrganizerDto, CreateOrganizerDto, OrganizerPublicResponseDto, OrganizerSelfResponseDto, RejectOrganizerDto, OrganizerAuditAction, OrganizerAuditLogEntity (+5 more)

### Community 10 - "Organizer Admin DTOs"
Cohesion: 0.18
Nodes (12): AppController, AppModule, AppService, AuthModule, CurrentUser (param decorator), Global JWT Guard Pattern (APP_GUARD with RolesGuard chained), JwtAuthGuard, NestJS Framework (+4 more)

### Community 11 - "Coverage Prettify"
Cohesion: 0.35
Nodes (8): a(), B(), D(), g(), i(), k(), Q(), y()

### Community 12 - "Coverage Block Nav"
Cohesion: 0.18
Nodes (9): Code style, CodeGraph, Comments, Dependencies, Formatting, Git, Logging, Structure (+1 more)

### Community 13 - "Baseline Migration"
Cohesion: 0.7
Nodes (4): goToNext(), goToPrevious(), makeCurrent(), toggleClass()

## Knowledge Gaps
- **40 isolated node(s):** `Description`, `code:bash ($ pnpm install)`, `code:bash (# development)`, `code:bash (# unit tests)`, `code:bash ($ pnpm install -g @nestjs/mau)` (+35 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `EventsService` connect `Module Registry` to `Users & Webhook Processing`?**
  _High betweenness centrality (0.061) - this node is a cross-community bridge._
- **Why does `UserEntity` connect `App Bootstrap & Core` to `Organizer Access Control`, `Categories CRUD Layer`, `Coverage Report Sorter`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `UserEntity` (e.g. with `OrganizerEntity` and `AuthenticatedUser`) actually correct?**
  _`UserEntity` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Description`, `code:bash ($ pnpm install)`, `code:bash (# development)` to the rest of the system?**
  _40 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Organizer Access Control` be split into smaller, more focused modules?**
  _Cohesion score 0.07 - nodes in this community are weakly interconnected._
- **Should `Categories CRUD Layer` be split into smaller, more focused modules?**
  _Cohesion score 0.07 - nodes in this community are weakly interconnected._
- **Should `App Bootstrap & Core` be split into smaller, more focused modules?**
  _Cohesion score 0.07 - nodes in this community are weakly interconnected._