import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { webcrypto } from 'node:crypto';

if (!globalThis.crypto) globalThis.crypto = webcrypto;
const { generateAccountSecret, generateOfferSecret, generateSecretToken } = await import('../utils/security.js');
const accountTokens = new Set(Array.from({ length: 1_000 }, generateAccountSecret));
const offerTokens = new Set(Array.from({ length: 1_000 }, generateOfferSecret));
assert.equal(accountTokens.size, 1_000, 'account tokens must be unique in this sample');
assert.equal(offerTokens.size, 1_000, 'offer tokens must be unique in this sample');
assert.match(generateSecretToken('HUD', 12), /^HUD-[A-Z2-9]{12}$/u);
assert.ok([...accountTokens].every((token) => /^ACC-[A-Z2-9]{12}$/u.test(token)));
assert.ok([...offerTokens].every((token) => /^OFF-[A-Z2-9]{12}$/u.test(token)));

const files = Object.freeze([
  'pages/admin.js', 'services/category-service.js', 'services/settings-service.js',
  'services/balance-service.js', 'services/auth-service.js', 'services/order-service.js',
  'services/supabase-client.js', 'supabase-adapter.js', 'admin.html', 'style.css'
]);
const source = Object.fromEntries(await Promise.all(files.map(async (file) => [file, await readFile(file, 'utf8')])));
for (const file of files.filter((file) => file.endsWith('.js'))) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  assert.equal(result.status, 0, `${file} syntax failure: ${result.stderr}`);
}
assert.match(source['pages/admin.js'], /export const showSavingIndicator/u);
assert.match(source['pages/admin.js'], /export const saveWithFeedback/u);
assert.match(source['pages/admin.js'], /subscribeTopupServices/u);
assert.match(source['pages/admin.js'], /deleteUserAccount/u);
assert.match(source['pages/admin.js'], /confirmOrder/u);
assert.match(source['services/category-service.js'], /generateOfferSecret/u);
assert.match(source['services/category-service.js'], /subscribeCategories/u);
assert.match(source['services/settings-service.js'], /officialContacts/u);
assert.match(source['services/settings-service.js'], /subscribeSiteSettings/u);
assert.match(source['services/balance-service.js'], /subscribeTopupServices/u);
assert.match(source['services/balance-service.js'], /SERVICES_META_ID/u);
assert.match(source['services/auth-service.js'], /createUserWithSecret/u);
assert.match(source['services/auth-service.js'], /deleteUserAccount/u);
assert.match(source['services/order-service.js'], /offerSecretToken/u);
assert.doesNotMatch(source['supabase-adapter.js'], /\bvar\b/u);
assert.doesNotMatch(source['supabase-adapter.js'], /window\./u);
for (const id of ['addOfficialContactBtn', 'saveTopupSettingsBtn', 'adminInstantCreditBtn', 'addServiceBtn', 'clearCustomerSearchBtn']) {
  assert.ok(source['admin.html'].includes(`id="${id}"`), `missing wired control ${id}`);
}
assert.match(source['style.css'], /\.spinner/u);
console.log('Admin panel regression checks passed: token generation, ES module syntax, save feedback, services, customers, orders, contacts, and Realtime wiring.');
