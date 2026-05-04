import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CategoryResponseItem } from './dto/category-response.dto';

// Registered at /api/v1/categories via global prefix + URI versioning
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  // Public endpoint — no authentication required (D-11, @Public bypasses global JwtAuthGuard)
  @Public()
  @Get()
  findAll(): Promise<CategoryResponseItem[]> {
    return this.categoriesService.findAll();
  }

  @Roles('admin')
  @Post()
  create(@Body() dto: CreateCategoryDto): Promise<CategoryResponseItem> {
    return this.categoriesService.create(dto);
  }

  // Returns 400 if slug is included in the body — write-once (D-02).
  // Note: ValidationPipe(whitelist: true) strips unknown fields, so slug would be silently dropped
  // if UpdateCategoryDto omits it. This explicit check provides clear API ergonomics per RESEARCH.md open question 1.
  @Roles('admin')
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ): Promise<CategoryResponseItem> {
    const body = dto as UpdateCategoryDto & { slug?: unknown };
    if ('slug' in body && body.slug !== undefined) {
      throw new BadRequestException('slug is immutable after creation');
    }
    return this.categoriesService.update(id, dto);
  }

  @Roles('admin')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string): Promise<void> {
    return this.categoriesService.remove(id);
  }
}
