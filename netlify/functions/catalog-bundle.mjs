import { json, normalized } from './_admin-core.mjs';

const imageURL = (image, params, version) => {
  if (/^https?:\/\//iu.test(String(image || ''))) return String(image);
  const query = new URLSearchParams({ ...params, v: String(version || 0) });
  return `/.netlify/functions/catalog-image?${query}`;
};
const stripOffer = (offer, categoryId, itemId, version) => {
  const { secretToken, offerPassword, image, ...safe } = offer || {};
  return { ...safe, image: image ? imageURL(image, { categoryId, itemId, offerId: String(offer.id || '') }, version) : '' };
};
const stripItem = (item, categoryId, version) => {
  const { image, ...safe } = item || {};
  return {
    ...safe,
    image: image ? imageURL(image, { categoryId, itemId: String(item.id || '') }, version) : '',
    offers: (item?.offers || []).map((offer) => stripOffer(offer, categoryId, String(item.id || ''), version))
  };
};
const stripCategory = (category) => {
  const { image, ...safe } = category || {};
  const version = category.updatedAt || category.id || 0;
  return {
    ...safe,
    image: image ? imageURL(image, { categoryId: String(category.id || '') }, version) : '',
    items: (category.items || []).map((item) => stripItem(item, String(category.id || ''), version))
  };
};

export const handler = async (event) => {
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });
  try {
    const categories = (await normalized.list('categories'))
      .filter((entry) => entry.enabled !== false)
      .sort((a,b) => Number(a.order||0)-Number(b.order||0))
      .map(stripCategory);
    return json(200, { categories, generatedAt: new Date().toISOString() }, {
      'cache-control': 'public, max-age=20, s-maxage=60, stale-while-revalidate=300'
    });
  } catch (error) {
    console.error('[catalog-bundle]', error);
    return json(500, { error: 'تعذر تحميل بيانات الكتالوج' });
  }
};
