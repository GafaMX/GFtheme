export type PageQuery = {
  page?: string;
  per_page?: string;
};

export type PageMeta = {
  page: number;
  per_page: number;
  offset: number;
  total: number;
  pages: number;
};

export function readPage(query: PageQuery, fallbackPerPage = 25): { page: number; perPage: number; offset: number } {
  const page = Math.max(1, Math.floor(Number(query.page) || 1));
  const perPage = Math.min(50, Math.max(10, Math.floor(Number(query.per_page) || fallbackPerPage)));
  return { page, perPage, offset: (page - 1) * perPage };
}

export function pageMeta(total: number, page: number, perPage: number): PageMeta {
  const safeTotal = Math.max(0, Number(total) || 0);
  const pages = Math.max(1, Math.ceil(safeTotal / perPage) || 1);
  const safePage = Math.min(page, pages);
  return {
    page: safePage,
    per_page: perPage,
    offset: (safePage - 1) * perPage,
    total: safeTotal,
    pages,
  };
}
