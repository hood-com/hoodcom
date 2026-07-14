import { escapeHTML, safeURL } from '../utils/sanitizers.js';
import { icon } from '../utils/icons.js';

export const WalletGrid = ({ wallets = [], selectedWallet = null } = {}) => `<div class="wallet-grid" role="radiogroup" aria-label="اختيار المحفظة">
  ${wallets.map((wallet) => `<button type="button" class="wallet-card${selectedWallet?.id === wallet.id ? ' selected' : ''}" role="radio" aria-checked="${selectedWallet?.id === wallet.id}" data-action="select-wallet" data-wallet-id="${escapeHTML(wallet.id)}">
    <span class="wallet-image">${wallet.image ? `<img src="${escapeHTML(safeURL(wallet.image, ''))}" alt="">` : icon('wallet', 28)}</span>
    <strong>${escapeHTML(wallet.name)}</strong><small dir="ltr">${escapeHTML(wallet.number || '')}</small>
  </button>`).join('')}
</div>`;

export default WalletGrid;
