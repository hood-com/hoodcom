import { getDB } from './supabase-client.js';
import { getCurrentUser } from './auth-service.js';
import { sanitizeInput, sanitizeValue } from '../utils/sanitizers.js';
import { generateSecretToken } from '../utils/security.js';
import { getOfferSecret } from './category-service.js';

const ORDER_STATUSES = Object.freeze(['pending', 'processing', 'completed', 'cancelled', 'rejected', 'refunded']);
const clone = (value) => JSON.parse(JSON.stringify(value));
const makeOrderId = () => generateSecretToken('ORD', 12);
const hideManagerFields = (order = {}) => {
  const { offerSecretToken, orderSecretToken, adminNotes, ...safeOrder } = order;
  return safeOrder;
};
const normalizeOrder = (orderData = {}) => {
  const id = String(orderData.id || makeOrderId());
  return {
    ...orderData,
    id,
    orderId: orderData.orderId || id,
    status: ORDER_STATUSES.includes(orderData.status) ? orderData.status : 'pending',
    total: Number(orderData.total || orderData.price || 0),
    notes: sanitizeValue(orderData.notes || ''),
    customerFields: orderData.customerFields && typeof orderData.customerFields === 'object' ? orderData.customerFields : {},
    // Snapshot the offer reference at order time, so a later offer edit cannot
    // invalidate the manager's verification trail.
    offerSecretToken: sanitizeInput(orderData.offerSecretToken || '', 100).toUpperCase(),
    orderSecretToken: sanitizeInput(orderData.orderSecretToken || generateSecretToken('ORD'), 100).toUpperCase(),
    createdAt: orderData.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
};

export const createOrder = async (orderData) => {
  try {
    const user = await getCurrentUser();
    if (!user?.uid && !orderData?.userId) throw new Error('يجب تسجيل الدخول لإنشاء الطلب');
    const resolvedOfferSecret = orderData?.offerSecretToken || await getOfferSecret(
      orderData?.categoryId, orderData?.itemId, orderData?.offerId
    );
    // Security: enforce server-side price to prevent client tampering
    let serverPrice = null;
    try {
      const { getCategoryById } = await import('./category-service.js');
      const cat = await getCategoryById(orderData.categoryId).catch(() => null);
      const item = cat?.items?.find(i => i.id === String(orderData.itemId));
      const offer = item?.offers?.find(o => o.id === String(orderData.offerId));
      if (offer && Number.isFinite(Number(offer.price))) serverPrice = Number(offer.price);
    } catch {}
    const finalPrice = serverPrice !== null ? serverPrice : Number(orderData.price || orderData.total || 0);
    if (!(finalPrice > 0)) throw new Error('سعر العرض غير صالح');
    const order = normalizeOrder({
      ...orderData,
      price: finalPrice,
      total: finalPrice,
      offerSecretToken: resolvedOfferSecret || '',
      userId: orderData?.userId || user.uid,
      userEmail: orderData?.userEmail || user.email || '',
      userName: orderData?.userName || user.displayName || user.name || ''
    });
    await (await getDB()).setDocument('orders', order.id, order);
    return hideManagerFields(order);
  } catch (error) {
    console.error('[order-service] create failed', error);
    throw error;
  }
};
export const saveOrderToFirestore = createOrder;
export const submitOrderOnSite = createOrder;

export const getUserOrders = async (userId) => {
  try {
    const resolvedId = userId || (await getCurrentUser())?.uid;
    if (!resolvedId) return [];
    // Security fix: server-side filtering to prevent IDOR - only fetch current user's orders
    let orders;
    try {
      orders = await (await getDB()).getCollection('orders', { filter: { userId: String(resolvedId) } });
    } catch {
      // Fallback to client-side filtering if server filter not supported (backward compat)
      orders = await (await getDB()).getCollection('orders');
      orders = orders.filter((order) => String(order.userId || order.uid || '') === String(resolvedId));
    }
    return orders
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .map((order) => hideManagerFields(order));
  } catch (error) {
    console.error('[order-service] user orders failed', error);
    throw error;
  }
};
export const loadUserOrders = getUserOrders;

export const getOrderById = async (id, options = {}) => {
  try {
    const order = await (await getDB()).getDocument('orders', id);
    return options.includeSecrets ? order : hideManagerFields(order);
  } catch (error) {
    console.error('[order-service] get failed', error);
    throw error;
  }
};
const normalizeOrderForAdmin = async (db, order) => {
  const normalized = normalizeOrder(order);
  const patch = {};
  if (!order.orderSecretToken) patch.orderSecretToken = normalized.orderSecretToken;
  if (!order.offerSecretToken && normalized.offerSecretToken) patch.offerSecretToken = normalized.offerSecretToken;
  // Legacy orders receive one stable server-persisted reference instead of a
  // new reference every time an administrator reloads the dashboard.
  if (Object.keys(patch).length) await db.updateDocument('orders', normalized.id, { ...patch, updatedAt: new Date().toISOString() });
  return { ...normalized, ...patch };
};
export const getAllOrdersForAdmin = async () => {
  const db = await getDB();
  const orders = await db.getCollection('orders');
  const normalized = await Promise.all(orders.map((order) => normalizeOrderForAdmin(db, order)));
  return normalized.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
};
export const subscribeOrdersForAdmin = async (listener, onError) => (await getDB()).subscribe('orders', async (rows) => {
  try {
    const db = await getDB();
    const normalized = await Promise.all(rows.map((order) => normalizeOrderForAdmin(db, order)));
    listener(normalized.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)));
  } catch (error) { onError?.(error); }
}, onError);

export const updateOrderStatus = async (id, status, extra = {}) => {
  try {
    if (!ORDER_STATUSES.includes(status)) throw new Error('حالة الطلب غير صالحة');
    const saved = await (await getDB()).updateDocument('orders', id, {
      ...extra,
      status,
      updatedAt: new Date().toISOString(),
      decidedAt: ['completed', 'rejected', 'cancelled', 'refunded'].includes(status) ? new Date().toISOString() : extra.decidedAt
    });
    return saved;
  } catch (error) {
    console.error('[order-service] status update failed', error);
    throw error;
  }
};
export const confirmOrder = async (id, adminNotes = '') => updateOrderStatus(id, 'completed', { adminNotes: sanitizeInput(adminNotes, 1000) });
export const rejectOrder = async (id, adminNotes = '') => updateOrderStatus(id, 'rejected', { adminNotes: sanitizeInput(adminNotes, 1000) });
export const updateAdminOrderStatus = updateOrderStatus;

export default Object.freeze({
  saveOrderToFirestore, loadUserOrders, updateAdminOrderStatus, submitOrderOnSite,
  createOrder, getUserOrders, getOrderById, getAllOrdersForAdmin, subscribeOrdersForAdmin,
  updateOrderStatus, confirmOrder, rejectOrder
});
