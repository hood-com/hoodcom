import { getClient, getDB } from '../services/supabase-client.js';
import supabaseConfig from '../config/supabase.js';
import { escapeHTML } from '../utils/sanitizers.js';

let testId = null;
const logs = [];
const log = (message) => { logs.unshift(`[${new Date().toLocaleTimeString('ar')}] ${message}`); const target = document.getElementById('log'); if (target) target.textContent = logs.slice(0, 50).join('\n'); };
const result = (id, message, type = 'ok') => { const target = document.getElementById(id); if (target) target.innerHTML = `<span class="${type}">${escapeHTML(message)}</span>`; };

export const initDebugPage = async () => {
  const info = document.getElementById('configInfo'); if (info) info.innerHTML = `<p>URL: <span class="ok">${escapeHTML(supabaseConfig.url)} ✅</span></p><p>Anon Key: <span class="ok">${escapeHTML(supabaseConfig.anonKey.slice(0, 30))}… ✅</span></p>`;
  const buttons = [...document.querySelectorAll('.box button')];
  buttons[0]?.addEventListener('click', async () => { try { const client = await getClient(); const { data, error } = await client.from('hud_docs').select('id').limit(1); if (error) throw error; result('connResult', `✅ الاتصال يعمل، ${data?.length || 0} سجل`); log('اختبار الاتصال ناجح'); } catch (error) { result('connResult', `❌ ${error.message}`, 'err'); log(error.message); } });
  buttons[1]?.addEventListener('click', async () => { try { const rows = await (await getDB()).getCollection('settings', { limit: 20 }); result('readResult', `✅ تمت قراءة ${rows.length} سجل`); log('القراءة ناجحة'); } catch (error) { result('readResult', `❌ ${error.message}`, 'err'); } });
  buttons[2]?.addEventListener('click', async () => { try { testId = `test-${Date.now()}`; await (await getDB()).setDocument('test', testId, { message: 'اختبار ناجح', time: new Date().toISOString() }); result('writeResult', `✅ تم الحفظ: ${testId}`); } catch (error) { result('writeResult', `❌ ${error.message}`, 'err'); } });
  buttons[3]?.addEventListener('click', async () => { try { if (!testId) throw new Error('أنشئ سجلاً تجريبياً أولاً'); await (await getDB()).deleteDocument('test', testId); result('deleteResult', '✅ تم الحذف'); testId = null; } catch (error) { result('deleteResult', `⚠️ ${error.message}`, 'warn'); } });
};

export default initDebugPage;
