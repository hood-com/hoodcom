import crypto from 'node:crypto';
import { db, json, normalized, verifyUserJWT } from './_admin-core.mjs';

const cleanObject = (value, depth = 0) => {
  if (depth > 4 || value === null || value === undefined) return null;
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => cleanObject(item, depth + 1));
  if (typeof value === 'object') return Object.fromEntries(Object.entries(value).slice(0, 100).map(([key, item]) => [String(key).slice(0, 100), cleanObject(item, depth + 1)]));
  if (typeof value === 'string') return value.trim().slice(0, 2000);
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  return Boolean(value);
};
const id = (prefix) => `${prefix}-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  const user = await verifyUserJWT(event);
  if (!user) return json(401, { error: 'يجب تسجيل الدخول' });
  try {
    const body = JSON.parse(event.body || '{}');
    if (body.operation !== 'purchase') return json(400, { error: 'عملية غير مسموحة' });
    const idempotencyKey=String(body.idempotencyKey||'').slice(0,120);
    if(!idempotencyKey)return json(400,{error:'معرف العملية مطلوب'});
    const existing=(await normalized.list('orders')).find((entry)=>entry.userId===user.id&&entry.idempotencyKey===idempotencyKey);
    if(existing)return json(200,{ok:true,result:existing,duplicate:true});
    const category = await normalized.get('categories', String(body.categoryId || ''));
    const item = category?.items?.find((entry) => String(entry.id) === String(body.itemId));
    const offer = item?.offers?.find((entry) => String(entry.id) === String(body.offerId)) || item?.offers?.[0];
    if (!category || !item || !offer || offer.status === 'unavailable' || item.status === 'unavailable') return json(400, { error: 'العرض غير متاح' });
    const price = Number(offer.price || 0);
    if (!Number.isFinite(price) || price < 0) return json(400, { error: 'سعر العرض غير صالح' });
    const balanceRecord = await normalized.get('user_balances', user.id);
    const balance = Number(balanceRecord?.balance || 0);
    if (balance < price) return json(400, { error: 'الرصيد غير كافٍ' });
    const now = new Date().toISOString();
    const orderId = id('order');
    const tempToken = `HC1-${crypto.randomBytes(3).toString('hex').toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const order = {
      id: orderId, userId: user.id, userEmail: user.email || '', categoryId: category.id, categoryName: category.name,
      itemId: item.id, itemName: item.name, offerId: offer.id, offerName: offer.name || item.name,
      price, total: price, currency: offer.currency || 'YER', customerFields: cleanObject(body.customerFields || {}),
      paymentMethod: 'account_balance', idempotencyKey, tempToken, tempTokenStatus: 'active', contactChannel: '', status: 'pending', createdAt: now, updatedAt: now
    };
    const profile=await normalized.get('users',user.id);
    const privateOrder={orderId,tempToken,userId:user.id,accountSecretToken:profile?.secretToken||'',productSecretToken:offer.secretToken||offer.offerPassword||'',categoryId:category.id,itemId:item.id,offerId:offer.id,createdAt:now,status:'active'};
    await db.upsert('user_balances', user.id, { ...(balanceRecord || {}), userId: user.id, balance: balance - price, updatedAt: now });
    try { await db.upsert('orders', orderId, order); await db.upsert('order_private',orderId,privateOrder); await db.upsert('activity',`order-${orderId}`,{type:'order_created',orderId,userId:user.id,tempToken,createdAt:now}); }
    catch (error) {
      await Promise.all([db.remove('orders',orderId).catch(()=>{}),db.remove('order_private',orderId).catch(()=>{})]);
      await db.upsert('user_balances', user.id, { ...(balanceRecord || {}), userId: user.id, balance, updatedAt: new Date().toISOString() });
      throw error;
    }
    return json(200, { ok: true, result: order });
  } catch (error) {
    console.error('[customer-api]', error);
    return json(500, { error: error.message || 'فشلت العملية' });
  }
};
