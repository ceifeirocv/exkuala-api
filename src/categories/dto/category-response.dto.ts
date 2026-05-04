// Shape returned by GET /categories per category item (D-10).
// translations is a locale→name map; clients resolve their preferred locale client-side (D-11).
// No Accept-Language server-side resolution for categories (D-11, supersedes ROADMAP criterion #3 per D-12).
export interface CategoryResponseItem {
  id: string;
  slug: string;
  name: string;
  translations: Record<string, string>;
}
