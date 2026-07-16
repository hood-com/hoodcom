import { json, normalized } from './_admin-core.mjs';

const cleanImage = (value) => {
  const image = String(value || '');
  // Keep valid stored images, but never let an unexpectedly huge value dominate the home response.
  return image.length <= 450000 ? image : '';
};

export const handler = async (event) => {
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });
  try {
    const rows = await normalized.list('categories');
    const categories = rows
      .filter((entry) => entry.enabled !== false)
      .map((entry) => ({
        id: String(entry.id || ''), name: String(entry.name || 'قسم').slice(0, 120),
        description: String(entry.description || entry.desc || '').slice(0, 500),
        image: cleanImage(entry.image), enabled: entry.enabled !== false, order: Number(entry.order || 0)
      }))
      .sort((a, b) => a.order - b.order);
    return json(200, { categories }, {
      'cache-control': 'public, max-age=30, s-maxage=120, stale-while-revalidate=600',
      'access-control-allow-origin': '*'
    });
  } catch (error) {
    console.error('[catalog-api]', error);
    return json(500, { error: 'تعذر تحميل فهرس الأقسام' });
  }
};
