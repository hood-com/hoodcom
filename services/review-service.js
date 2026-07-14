import { getDB } from './supabase-client.js';
import { getCurrentUser } from './auth-service.js';
import { sanitizeInput } from '../utils/sanitizers.js';
import { isValidName, validateRequired } from '../utils/validators.js';

let reviews = [];
let unsubscribe = null;

const normalize = (review) => ({
  ...review,
  id: String(review?.id || `review-${Date.now()}`),
  name: sanitizeInput(review?.name || review?.displayName || 'عميل هود كوم', 50),
  message: sanitizeInput(review?.message, 500),
  rating: Math.max(1, Math.min(5, Number(review?.rating) || 5)),
  hidden: Boolean(review?.hidden),
  userId: String(review?.userId || ''),
  userEmail: String(review?.userEmail || ''),
  emailVerified: Boolean(review?.emailVerified),
  avatar: String(review?.avatar || (review?.name ? String(review.name).trim().charAt(0) : 'م')),
  createdAt: review?.createdAt || new Date().toISOString(),
  updatedAt: review?.updatedAt || new Date().toISOString()
});

export const setupReviewForm = (values = {}, user = null) => {
  // Auto-fill name from authenticated user - remove manual name field
  const displayName = user?.displayName || user?.name || user?.email?.split('@')[0] || values.name || 'عميل هود كوم';
  const review = normalize({ ...values, name: displayName });
  const errors = {};
  // Name is now auto-filled, skip name validation unless explicitly provided
  if (values.name && !isValidName(review.name, 1)) errors.name = 'الاسم غير صالح';
  if (!validateRequired(review.message)) errors.message = 'اكتب رسالتك';
  if (!review.rating || review.rating < 1 || review.rating > 5) errors.rating = 'التقييم مطلوب';
  return { review, errors, valid: Object.keys(errors).length === 0 };
};

export const canUserReview = async (userOverride = null) => {
  try {
    const user = userOverride || await getCurrentUser();
    if (!user) {
      return { allowed: false, reason: 'login_required', message: '🔒 سجل دخولك لتشاركنا رأيك' };
    }
    // Email must be verified - phone verification NOT required
    const emailVerified = user.emailVerified === true || user.email_verified === true || user.verified === true;
    if (!emailVerified) {
      return { allowed: false, reason: 'email_not_verified', message: '📧 يجب توثيق بريدك الإلكتروني لإضافة تعليق' };
    }
    return { allowed: true, user };
  } catch (error) {
    return { allowed: false, reason: 'error', message: 'تعذر التحقق من الحساب' };
  }
};

export const submitReview = async (values) => {
  try {
    const user = await getCurrentUser();
    const permission = await canUserReview(user);
    if (!permission.allowed) {
      const err = new Error(permission.message);
      err.code = permission.reason;
      throw err;
    }

    // Auto-fill name from user account - ignore submitted name field
    const displayName = user.displayName || user.name || user.email?.split('@')[0] || 'عميل هود كوم';
    const { review, errors, valid } = setupReviewForm({ ...values, name: displayName }, user);
    if (!valid) throw Object.assign(new Error('بيانات التقييم غير صالحة'), { errors });

    const entry = {
      ...review,
      name: displayName,
      userId: user?.uid || user?.id || '',
      userEmail: user?.email || '',
      emailVerified: true,
      verified: true,
      avatar: displayName.trim().charAt(0) || 'م',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await (await getDB()).setDocument('reviews', entry.id, entry);
    reviews.unshift(normalize(entry));

    // Notify UI
    if (typeof globalThis.CustomEvent === 'function') {
      globalThis.dispatchEvent?.(new CustomEvent('hud:review-submitted', { detail: entry }));
    }

    return { ...entry };
  } catch (error) {
    console.error('[review-service] submit failed', error);
    throw error;
  }
};

export const loadReviewsOnce = async (options = {}) => {
  try {
    reviews = (await (await getDB()).getCollection('reviews')).map(normalize)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return options.includeHidden ? reviews.slice() : reviews.filter((review) => !review.hidden);
  } catch (error) {
    console.error('[review-service] load failed', error);
    return [];
  }
};

export const renderReviews = (items = reviews, options = {}) => items
  .filter((review) => options.includeHidden || !review.hidden)
  .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  .map((review) => ({ ...review }));

export const startReviewsListener = async (listener, options = {}) => {
  unsubscribe?.();
  const db = await getDB();
  unsubscribe = db.subscribe('reviews', (rows) => {
    reviews = rows.map(normalize).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    listener(renderReviews(reviews, options));
  }, (error) => console.error('[review-service] listener failed', error));
  return unsubscribe;
};

export const initReviews = async (listener) => {
  const initial = await loadReviewsOnce();
  if (listener) await startReviewsListener(listener);
  return initial;
};

export const saveReviewEdit = async (id, updates) => {
  try {
    const patch = { ...updates, updatedAt: new Date().toISOString() };
    if (patch.name !== undefined) patch.name = sanitizeInput(patch.name, 50);
    if (patch.message !== undefined) patch.message = sanitizeInput(patch.message, 500);
    const saved = await (await getDB()).updateDocument('reviews', id, patch);
    reviews = reviews.map((review) => review.id === String(id) ? normalize(saved) : review);
    return normalize(saved);
  } catch (error) {
    console.error('[review-service] edit failed', error);
    throw error;
  }
};

export const toggleReviewHidden = async (id, hidden) => {
  const current = reviews.find((review) => review.id === String(id));
  return saveReviewEdit(id, { hidden: hidden ?? !current?.hidden });
};

export const deleteReview = async (id) => {
  try {
    await (await getDB()).deleteDocument('reviews', id);
    reviews = reviews.filter((review) => review.id !== String(id));
    return true;
  } catch (error) {
    console.error('[review-service] delete failed', error);
    throw error;
  }
};

// HUD COM refresh
export const refreshReviews = async (options = {}) => {
  try {
    const fresh = await loadReviewsOnce({ includeHidden: options.includeHidden || false });
    if (typeof globalThis.CustomEvent === 'function') {
      globalThis.dispatchEvent?.(new CustomEvent('hud:reviews-updated', {
        detail: { reviews: fresh, source: 'refresh', timestamp: Date.now() }
      }));
    }
    return fresh;
  } catch (error) {
    console.error('[review-service] refresh failed', error);
    throw error;
  }
};

if (typeof globalThis.window !== 'undefined') {
  globalThis.window.refreshReviews = refreshReviews;
}

export default Object.freeze({
  initReviews, setupReviewForm, submitReview, renderReviews, loadReviewsOnce, startReviewsListener,
  saveReviewEdit, toggleReviewHidden, deleteReview,
  refreshReviews, canUserReview
});
