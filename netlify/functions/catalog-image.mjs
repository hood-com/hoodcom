import { normalized } from './_admin-core.mjs';

const response = (statusCode, body = '', headers = {}, isBase64Encoded = false) => ({ statusCode, headers: { 'cache-control':'public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000', ...headers }, body, isBase64Encoded });
export const handler = async (event) => {
  if (event.httpMethod !== 'GET') return response(405, 'Method not allowed', { 'content-type':'text/plain' });
  try {
    const q=event.queryStringParameters||{}, category=await normalized.get('categories', String(q.categoryId||''));
    if (!category) return response(302,'',{location:'/content-placeholder.svg'});
    let entity=category;
    if(q.itemId) entity=(category.items||[]).find((item)=>String(item.id)===String(q.itemId));
    if(entity&&q.offerId) entity=(entity.offers||[]).find((offer)=>String(offer.id)===String(q.offerId));
    const image=String(entity?.image||'');
    if(!image) return response(302,'',{location:'/content-placeholder.svg'});
    if(/^https?:\/\//iu.test(image)) return response(302,'',{location:image});
    const match=image.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/su);
    if(!match) return response(302,'',{location:'/content-placeholder.svg'});
    return response(200,match[2],{'content-type':match[1],'x-content-type-options':'nosniff'},true);
  } catch(error){console.error('[catalog-image]',error);return response(302,'',{location:'/content-placeholder.svg'});}
};
