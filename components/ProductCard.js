import { escapeHTML, safeURL } from '../utils/sanitizers.js';
import { formatPrice } from '../utils/formatters.js';
import { icon } from '../utils/icons.js';

const statusLabels = { available: 'متوفر', unavailable: 'غير متوفر', coming_soon: 'قريباً' };

export const ProductCard = ({ product = {}, currency = 'YER', action = 'select-product' } = {}) => {
  const price = Number(product.price ?? product.offers?.[0]?.price ?? 0);
  const status = product.status || 'available';
  return `<article class="item-card status-${escapeHTML(status)}" data-product-id="${escapeHTML(product.id || '')}">
    <div class="item-image-wrap"><img src="${escapeHTML(safeURL(/(?:^|\/)logo\.svg(?:[?#]|$)/iu.test(String(product.image || '')) ? '' : product.image, 'content-placeholder.svg'))}" alt="${escapeHTML(product.name || '')}" loading="lazy"><span class="status-badge ${escapeHTML(status)}">${statusLabels[status] || status}</span></div>
    <div class="item-info"><h3>${escapeHTML(product.name || 'منتج')}</h3><p>${escapeHTML(product.description || product.desc || '')}</p>
      <div class="item-price">${price ? formatPrice(price, currency) : ''}</div>
      <button type="button" class="btn btn-gold" data-action="${escapeHTML(action)}" data-product-id="${escapeHTML(product.id || '')}" ${status !== 'available' ? 'disabled' : ''}>${icon('cart', 16)} عرض التفاصيل</button>
    </div>
  </article>`;
};

export default ProductCard;
