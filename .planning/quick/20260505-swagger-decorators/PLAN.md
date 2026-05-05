---
slug: swagger-decorators
created: 2026-05-05
status: in-progress
---

# Quick Task: Swagger Decorators for Categories Module

Add `@ApiProperty()` to category DTOs, `@ApiBearerAuth()` + `@ApiOperation()` + `@ApiResponse()` to CategoriesController, and DOC-01 requirement to ROADMAP.

## Files

- src/categories/dto/create-category.dto.ts — add @ApiProperty() with examples
- src/categories/dto/update-category.dto.ts — add @ApiProperty() with example
- src/categories/categories.controller.ts — add @ApiTags, @ApiBearerAuth, @ApiOperation, @ApiResponse
- .planning/ROADMAP.md — add DOC-01 requirement to Phase 4 + coverage map
- .planning/PROJECT.md — add DOC-01 to Documentation requirements section
