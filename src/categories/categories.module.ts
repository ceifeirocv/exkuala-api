import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoryEntity } from './category.entity';
import { CategoryTranslationEntity } from './category-translation.entity';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';

@Module({
  imports: [TypeOrmModule.forFeature([CategoryEntity, CategoryTranslationEntity])],
  controllers: [CategoriesController],
  providers: [CategoriesService],
  // No exports needed — no other module imports CategoriesService in Phase 4.
  // Phase 6+ (Event CRUD) may need to import this module when attaching categories to events.
})
export class CategoriesModule {}
