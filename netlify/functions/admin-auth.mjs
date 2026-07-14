import { changeCredentials, hasSession, json, makeSession, sessionCookie, verifyCredentials } from './_admin-core.mjs';

export const handler = async (event) => {
  try {
    if (event.httpMethod === 'GET') return json(200, { authenticated: hasSession(event) });
    if (event.httpMethod === 'DELETE') return json(200, { ok: true }, { 'set-cookie': sessionCookie('', true) });
    if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
    const body = JSON.parse(event.body || '{}');
    if (body.action === 'change-credentials') {
      if (!hasSession(event)) return json(401, { error: 'انتهت جلسة الإدارة' });
      await changeCredentials(String(body.username || '').trim(), String(body.password || ''));
      return json(200, { ok: true });
    }
    const valid = await verifyCredentials(String(body.username || '').trim(), String(body.password || ''));
    if (!valid) return json(401, { authenticated: false });
    return json(200, { authenticated: true }, { 'set-cookie': sessionCookie(makeSession()) });
  } catch (error) {
    console.error('[admin-auth]', error);
    return json(500, { error: 'تعذر تنفيذ مصادقة الإدارة. تحقق من متغيرات Netlify.' });
  }
};
