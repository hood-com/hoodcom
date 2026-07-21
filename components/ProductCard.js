import { escapeHTML, safeURL } from '../utils/sanitizers.js';

export const ProductCard = ({ product = {}, categoryId = product.categoryId || '', action = 'select-product' } = {}) => {
  const image = safeURL(/(?:^|\/)logo\.svg(?:[?#]|$)/iu.test(String(product.image || '')) ? '' : product.image, 'content-placeholder.svg');
  const disabled = product.status === 'unavailable';
  const href=`category.html?id=${encodeURIComponent(categoryId)}&item=${encodeURIComponent(product.id||'')}`;
  return `<a class="item-card catalog-choice-card${disabled ? ' is-disabled' : ''}" href="${escapeHTML(href)}" data-action="${escapeHTML(action)}" data-product-id="${escapeHTML(product.id || '')}" aria-disabled="${disabled}">
    <div class="item-image-wrap"><img src="content-placeholder.svg" data-catalog-src="${escapeHTML(image)}" alt="${escapeHTML(product.name || '')}" loading="lazy" decoding="async" fetchpriority="low" width="420" height="300"></div>
    <div class="item-info"><h3>${escapeHTML(product.name || 'منتج')}</h3><p>${escapeHTML(product.description || product.desc || '')}</p></div>
  </a>`;
};
export default ProductCard;
