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
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CategoryResponseItem } from './dto/category-response.dto';

const CATEGORY_EXAMPLE = {
  id: 'cuid2exampleid00001',
  slug: 'music',
  name: 'Music',
  translations: { pt: 'Música' },
};

// Registered at /api/v1/categories via global prefix + URI versioning
@ApiTags('Categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  // Public endpoint — no authentication required (D-11, @Public bypasses global JwtAuthGuard)
  @Public()
  @Get()
  @ApiOperation({ summary: 'List all categories with translations map' })
  @ApiResponse({
    status: 200,
    description: 'Array of all categories. Each item includes default name, slug, and locale→name translations map.',
    schema: {
      type: 'array',
      items: { example: CATEGORY_EXAMPLE },
    },
  })
  findAll(): Promise<CategoryResponseItem[]> {
    return this.categoriesService.findAll();
  }

  @Roles('admin')
  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new category (admin only)' })
  @ApiResponse({
    status: 201,
    description: 'Category created. Slug is auto-derived from name if not provided.',
    schema: { example: CATEGORY_EXAMPLE },
  })
  @ApiResponse({ status: 409, description: 'Slug already taken.' })
  create(@Body() dto: CreateCategoryDto): Promise<CategoryResponseItem> {
    return this.categoriesService.create(dto);
  }

  // Returns 400 if slug is included in the body — write-once (D-02).
  // Note: ValidationPipe(whitelist: true) strips unknown fields, so slug would be silently dropped
  // if UpdateCategoryDto omits it. This explicit check provides clear API ergonomics per RESEARCH.md open question 1.
  @Roles('admin')
  @Patch(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a category name (admin only). Slug is immutable after creation.' })
  @ApiResponse({
    status: 200,
    description: 'Category updated.',
    schema: { example: { ...CATEGORY_EXAMPLE, name: 'Rock Music' } },
  })
  @ApiResponse({ status: 400, description: 'slug field included in body — slug is immutable after creation.' })
  @ApiResponse({ status: 404, description: 'Category not found.' })
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
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a category and cascade its translations (admin only)' })
  @ApiResponse({ status: 204, description: 'Category deleted.' })
  @ApiResponse({ status: 404, description: 'Category not found.' })
  remove(@Param('id') id: string): Promise<void> {
    return this.categoriesService.remove(id);
  }
}
