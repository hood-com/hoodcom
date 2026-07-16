import { escapeHTML, safeURL } from '../utils/sanitizers.js';

export const ProductCard = ({ product = {}, action = 'select-product' } = {}) => {
  const image = safeURL(/(?:^|\/)logo\.svg(?:[?#]|$)/iu.test(String(product.image || '')) ? '' : product.image, 'content-placeholder.svg');
  const disabled = product.status === 'unavailable';
  return `<article class="item-card catalog-choice-card${disabled ? ' is-disabled' : ''}" data-action="${escapeHTML(action)}" data-product-id="${escapeHTML(product.id || '')}" role="button" tabindex="${disabled ? '-1' : '0'}" aria-disabled="${disabled}">
    <div class="item-image-wrap"><img src="${escapeHTML(image)}" alt="${escapeHTML(product.name || '')}" loading="lazy" decoding="async" fetchpriority="low" width="420" height="300"></div>
    <div class="item-info"><h3>${escapeHTML(product.name || 'منتج')}</h3><p>${escapeHTML(product.description || product.desc || '')}</p></div>
  </article>`;
};

export default ProductCard;
