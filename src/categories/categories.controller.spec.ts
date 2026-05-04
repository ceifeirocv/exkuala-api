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

  it('GET /categories calls service.findAll()', async () => {
    const expected = [{ id: 'c1', slug: 'music', name: 'Music', translations: { pt: 'Música' } }];
    mockCategoriesService.findAll.mockResolvedValue(expected);

    const result = await controller.findAll();

    expect(mockCategoriesService.findAll).toHaveBeenCalled();
    expect(result).toEqual(expected);
  });

  it('POST /categories calls service.create() with dto', async () => {
    await controller.create({ name: 'Music' });

    expect(mockCategoriesService.create).toHaveBeenCalledWith({ name: 'Music' });
  });

  it('PATCH /categories/:id calls service.update() with id and dto', async () => {
    await controller.update('c1', { name: 'Rock Music' });

    expect(mockCategoriesService.update).toHaveBeenCalledWith('c1', { name: 'Rock Music' });
  });

  it('DELETE /categories/:id calls service.remove() with id', async () => {
    await controller.remove('c1');

    expect(mockCategoriesService.remove).toHaveBeenCalledWith('c1');
  });
});
