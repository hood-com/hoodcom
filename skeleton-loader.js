(() => {
  'use strict';
  const ID = 'hudSkeletonLoader';
  const startedAt = Date.now();
  const minimumVisibleMs = 420;
  const maximumVisibleMs = 15000;
  let removed = false;

  const markup = `
    <div class="hud-skeleton-shell" role="status" aria-live="polite" aria-label="جاري تحميل الصفحة">
      <div class="hud-skeleton-topbar">
        <span class="hud-skeleton-block hud-sk-logo"></span>
        <div class="hud-sk-top-actions">
          <span class="hud-skeleton-circle"></span><span class="hud-skeleton-circle"></span><span class="hud-skeleton-circle"></span>
        </div>
      </div>
      <main class="hud-skeleton-content" aria-hidden="true">
        <section class="hud-sk-hero">
          <span class="hud-skeleton-block hud-sk-title"></span>
          <span class="hud-skeleton-block hud-sk-subtitle"></span>
          <span class="hud-skeleton-block hud-sk-subtitle hud-sk-short"></span>
          <div class="hud-sk-buttons"><span class="hud-skeleton-block"></span><span class="hud-skeleton-block"></span></div>
        </section>
        <section class="hud-sk-section">
          <span class="hud-skeleton-block hud-sk-heading"></span>
          <span class="hud-skeleton-block hud-sk-caption"></span>
          <div class="hud-sk-grid">
            <article class="hud-sk-card"><span class="hud-skeleton-block hud-sk-image"></span><span class="hud-skeleton-block hud-sk-line"></span><span class="hud-skeleton-block hud-sk-line hud-sk-short"></span></article>
            <article class="hud-sk-card"><span class="hud-skeleton-block hud-sk-image"></span><span class="hud-skeleton-block hud-sk-line"></span><span class="hud-skeleton-block hud-sk-line hud-sk-short"></span></article>
            <article class="hud-sk-card"><span class="hud-skeleton-block hud-sk-image"></span><span class="hud-skeleton-block hud-sk-line"></span><span class="hud-skeleton-block hud-sk-line hud-sk-short"></span></article>
            <article class="hud-sk-card"><span class="hud-skeleton-block hud-sk-image"></span><span class="hud-skeleton-block hud-sk-line"></span><span class="hud-skeleton-block hud-sk-line hud-sk-short"></span></article>
          </div>
        </section>
      </main>
      <div class="hud-skeleton-bottom" aria-hidden="true">
        <span class="hud-skeleton-circle"></span><span class="hud-skeleton-circle"></span><span class="hud-skeleton-circle hud-sk-main-action"></span><span class="hud-skeleton-circle"></span><span class="hud-skeleton-circle"></span>
      </div>
      <span class="hud-skeleton-sr">جاري تجهيز المحتوى…</span>
    </div>`;

  const mount = () => {
    if (document.getElementById(ID) || document.documentElement.dataset.appReady === 'true') return;
    const root = document.createElement('div');
    root.id = ID;
    root.className = 'hud-skeleton-loader';
    root.innerHTML = markup;
    document.body.prepend(root);
    document.body.classList.add('hud-is-loading');
  };

  const remove = () => {
    if (removed) return;
    const elapsed = Date.now() - startedAt;
    if (elapsed < minimumVisibleMs) {
      globalThis.setTimeout(remove, minimumVisibleMs - elapsed);
      return;
    }
    removed = true;
    const root = document.getElementById(ID);
    document.body.classList.remove('hud-is-loading');
    if (!root) return;
    root.classList.add('hud-skeleton-leave');
    globalThis.setTimeout(() => root.remove(), 260);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();

  const observer = new MutationObserver(() => {
    if (document.documentElement.dataset.appReady === 'true' || document.documentElement.dataset.appError === 'true') {
      observer.disconnect(); remove();
    }
  });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-app-ready', 'data-app-error'] });
  globalThis.addEventListener('pageshow', () => {
    if (document.documentElement.dataset.appReady === 'true') remove();
  }, { once: true });
  globalThis.setTimeout(remove, maximumVisibleMs);
})();
