import { icon } from '../utils/icons.js';
import { escapeHTML } from '../utils/sanitizers.js';

/**
 * HUD COM Modern Review Form
 * - Auto-fills name from authenticated user
 * - Requires emailVerified
 * - Modern star UI
 */
export const ReviewForm = ({ user = null, rating = 5, submitting = false, canReview = null } = {}) => {
  // Not logged in
  if (!user) {
    return `<div class="review-login-message review-gate-card">
      <div class="review-gate-icon">${icon('user', 36)}</div>
      <h3>شاركنا تجربتك</h3>
      <p>🔒 سجل دخولك لتشاركنا رأيك وتقييمك لمتجر هود كوم</p>
      <a href="login.html" class="btn btn-gold btn-full" style="margin-top:14px;">
        ${icon('user', 18)}
        <span>تسجيل الدخول</span>
      </a>
      <small style="display:block;margin-top:10px;color:var(--text-secondary);">رأيك يهمنا ويساعد عملاء آخرين</small>
    </div>`;
  }

  // Email not verified
  const emailVerified = user.emailVerified === true || user.email_verified === true || user.verified === true;
  if (!emailVerified) {
    return `<div class="review-verify-message review-gate-card warn">
      <div class="review-gate-icon">${icon('alert', 34)}</div>
      <h3>وثّق بريدك أولاً</h3>
      <p>📧 يجب توثيق بريدك الإلكتروني لإضافة تعليق</p>
      <div style="background:rgba(255,215,0,0.07);border:1px dashed var(--gold);border-radius:12px;padding:12px;margin:12px 0;font-size:13px;text-align:center;">
        تم إرسال رابط التوثيق إلى:<br><strong style="color:var(--gold);direction:ltr;">${escapeHTML(user.email || '')}</strong>
      </div>
      <button class="btn btn-outline btn-full" type="button" onclick="window.resendVerification?.()" id="resendVerifyBtn">
        ${icon('send', 16)}
        <span>إعادة إرسال رابط التوثيق</span>
      </button>
    </div>`;
  }

  const displayName = escapeHTML(user.displayName || user.name || user.email?.split('@')[0] || 'مستخدم');
  const avatarChar = displayName.trim().charAt(0) || 'م';
  const userEmail = escapeHTML(user.email || '');

  return `<form class="review-form review-form-modern" id="reviewForm" novalidate>
  <div class="review-user-info">
    <div class="review-user-avatar" aria-hidden="true">${avatarChar}</div>
    <div class="review-user-meta">
      <div class="review-user-name">${displayName}</div>
      <div class="review-user-email">${userEmail} <span class="verified-badge" title="بريد موثّق">✓</span></div>
    </div>
    <div class="review-encourage">✨ رأيك يهمنا</div>
  </div>

  <div class="form-group">
    <label class="form-label">
      ${icon('star', 16)}
      <span>تقييمك للمتجر</span>
    </label>
    <div class="review-stars-input modern-stars" id="reviewStarsInput" role="radiogroup" aria-label="التقييم بالنجوم">
      ${[1,2,3,4,5].map(value => `
        <button type="button" class="star-btn ${value <= rating ? 'active' : ''}" data-value="${value}" aria-label="${value} نجوم" aria-pressed="${value <= rating ? 'true' : 'false'}">
          <svg viewBox="0 0 24 24" width="32" height="32" aria-hidden="true">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        </button>
      `).join('')}
    </div>
    <input type="hidden" id="reviewRating" name="rating" value="${rating}">
    <div class="star-hint" id="starHint" style="font-size:12px;color:var(--text-secondary);margin-top:4px;">ممتاز! شكراً لتقييمك ⭐</div>
  </div>

  <div class="form-group">
    <label class="form-label" for="reviewMessage">
      ${icon('edit', 16)}
      <span>شاركنا تجربتك</span>
    </label>
    <textarea class="form-input review-textarea" id="reviewMessage" name="message" maxlength="500" rows="3" placeholder="اكتب رأيك عن تجربتك مع هود كوم... ما الذي أعجبك؟" required></textarea>
    <div class="review-char-counter"><span id="reviewCharCount">0</span> / 500</div>
  </div>

  <button class="btn btn-gold btn-full review-submit-btn" type="submit" ${submitting ? 'disabled' : ''} id="reviewSubmitBtn">
    ${icon(submitting ? 'bolt' : 'send', 18)}
    <span>${submitting ? 'جاري النشر...' : 'نشر التعليق الآن'}</span>
  </button>

  <p class="review-assurance">💬 تعليقك سيظهر للجميع فوراً • نراجع التعليقات للحفاظ على بيئة إيجابية</p>
</form>`;
};

export const ReviewCard = ({ review = {} } = {}) => {
  const name = escapeHTML(review.name || 'عميل هود كوم');
  const message = escapeHTML(review.message || '');
  const rating = Math.max(1, Math.min(5, Number(review.rating) || 5));
  const avatar = escapeHTML(review.avatar || name.charAt(0) || 'م');
  const date = review.createdAt ? new Date(review.createdAt).toLocaleDateString('ar-YE') : '';
  const verified = review.emailVerified || review.verified;

  return `<article class="review-card modern-review-card">
    <div class="review-card-header">
      <div class="review-card-avatar">${avatar}</div>
      <div class="review-card-meta">
        <strong class="review-card-name">${name} ${verified ? '<span class="verified-tiny" title="موثق">✓</span>' : ''}</strong>
        <div class="review-card-stars" aria-label="${rating} من 5">
          ${'★'.repeat(rating)}<span class="stars-empty">${'★'.repeat(5-rating)}</span>
        </div>
      </div>
      <time class="review-card-date">${date}</time>
    </div>
    <p class="review-card-message">${message}</p>
  </article>`;
};

export default ReviewForm;
