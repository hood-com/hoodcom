import { escapeHTML, safeURL } from '../utils/sanitizers.js';
export const CategoryCard = ({ category = {}, href } = {}) => {
  const target = href || `category.html?id=${encodeURIComponent(category.id || '')}`;
  const image = safeURL(/(?:^|\/)logo\.svg(?:[?#]|$)/iu.test(String(category.image || '')) ? '' : category.image, 'content-placeholder.svg');
  return `<article class="category-card" data-category-id="${escapeHTML(category.id || '')}">
    <a href="${escapeHTML(target)}" class="category-card-link">
      <div class="category-image-wrap"><img src="content-placeholder.svg" data-catalog-src="${escapeHTML(image)}" alt="${escapeHTML(category.name || '')}" loading="lazy" decoding="async" fetchpriority="low" width="420" height="300"></div>
      <div class="category-info"><h3>${escapeHTML(category.name || 'قسم')}</h3><p>${escapeHTML(category.description || category.desc || '')}</p></div>
    </a>
  </article>`;
};

export default CategoryCard;
