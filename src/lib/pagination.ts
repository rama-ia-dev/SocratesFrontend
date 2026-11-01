// Trae todas las páginas de un listado (el backend devuelve hasta 100 por consulta)
export async function fetchAll<T>(
  fetchPage: (offset: number) => Promise<{ items: T[]; total: number }>
): Promise<T[]> {
  const items: T[] = [];
  for (;;) {
    const page = await fetchPage(items.length);
    items.push(...page.items);
    if (page.items.length === 0 || items.length >= page.total) return items;
  }
}
