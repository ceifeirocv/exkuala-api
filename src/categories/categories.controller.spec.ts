import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';

// Named mock service per CLAUDE.md: "Mock external I/O with named fake classes, not inline stubs"
const mockCategoriesService = {
  findAll: jest.fn().mockResolvedValue([]),
  create: jest.fn().mockResolvedValue({}),
  update: jest.fn().mockResolvedValue({}),
  remove: jest.fn().mockResolvedValue(undefined),
};

describe('CategoriesController', () => {
  let controller: CategoriesController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new CategoriesController(mockCategoriesService as unknown as CategoriesService);
  });

  it('GET /categories calls service.findAll()', () => {
    expect(true).toBe(false);
  });

  it('POST /categories calls service.create() with dto', () => {
    expect(true).toBe(false);
  });

  it('PATCH /categories/:id calls service.update() with id and dto', () => {
    expect(true).toBe(false);
  });

  it('DELETE /categories/:id calls service.remove() with id', () => {
    expect(true).toBe(false);
  });
});
