import { db } from './db.mjs';
let verifiedAt = 0;
export function publishingConfigured() {
  return Boolean(process.env.IG_ACCESS_TOKEN && process.env.IG_ACCOUNT_ID && process.env.IG_GRAPH_VERSION);
}
async function graph(path, method = 'GET', fields = {}) {
  const host = process.env.IG_GRAPH_HOST || 'graph.instagram.com';
  if (!['graph.instagram.com', 'graph.facebook.com'].includes(host) || !/^v\d+\.\d+$/.test(process.env.IG_GRAPH_VERSION || '')) throw new Error('invalid_instagram_configuration');
  const url = new URL(`https://${host}/${process.env.IG_GRAPH_VERSION}/${path}`);
  if (method === 'GET') Object.entries(fields).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  const r = await fetch(url, { method, signal: AbortSignal.timeout(20000),
    headers: { Authorization: 'Bearer ' + process.env.IG_ACCESS_TOKEN, ...(method === 'POST' ? { 'content-type': 'application/x-www-form-urlencoded' } : {}) },
    ...(method === 'POST' ? { body: new URLSearchParams(fields) } : {}) });
  if (!r.ok) throw new Error('instagram_http_' + r.status);
  const data = await r.json(); if (data.error) throw new Error('instagram_rejected'); return data;
}
export async function verifyInstagramAccount() {
  if (!publishingConfigured()) return false;
  if (Date.now() - verifiedAt < 3600000) return true;
  const account = await graph(process.env.IG_ACCOUNT_ID, 'GET', { fields: 'id,username' });
  if (String(account.username).toLowerCase() !== 'sofiesmakeupstore') throw new Error('instagram_wrong_account');
  verifiedAt = Date.now(); return true;
}
export async function publishDueContent() {
  if (process.env.AUTO_PUBLISH !== 'true' || !(await verifyInstagramAccount())) return { enabled: false, reason: 'instagram_not_connected' };
  const record = await db('rpc/growth_claim_publish', { method: 'POST', body: {} });
  if (!record) return { enabled: true, published: 0 };
  const patch = fields => db('growth_content?id=eq.' + encodeURIComponent(record.id), { method: 'PATCH', body: { ...fields, updated_at: new Date().toISOString() } });
  try {
    // Claim and persist state before either non-idempotent POST. An uncertain
    // outcome is held for inspection; never create a second post automatically.
    const u = new URL(record.asset_url);
    if (u.protocol !== 'https:' || u.username || u.password) throw new Error('invalid_asset');
    const fields = record.format === 'reel' ? { media_type: 'REELS', video_url: u.toString(), share_to_feed: 'true' }
      : { image_url: u.toString(), alt_text: record.metadata?.alt_text || 'SOFIE beauty education' };
    if (!['reel', 'image'].includes(record.format)) throw new Error('format_requires_scheduler');
    const created = await graph(process.env.IG_ACCOUNT_ID + '/media', 'POST', { ...fields, caption: record.caption_ar });
    if (!created.id) throw new Error('container_unknown');
    await patch({ publish_container_id: String(created.id) });
    let state;
    for (let attempt = 0; attempt < 5; attempt++) {
      state = await graph(String(created.id), 'GET', { fields: 'status_code' });
      if (state.status_code === 'FINISHED') break;
      if (['ERROR', 'EXPIRED', 'PUBLISHED'].includes(state.status_code)) throw new Error('container_' + state.status_code.toLowerCase());
      if (attempt < 4) await new Promise(r => setTimeout(r, 60000));
    }
    if (state.status_code !== 'FINISHED') { await patch({ status: 'held', blocker: 'Container not ready; inspect before resuming.' }); return { held: 1 }; }
    await patch({ metadata: { ...record.metadata, publish_attempted_at: new Date().toISOString() } });
    const result = await graph(process.env.IG_ACCOUNT_ID + '/media_publish', 'POST', { creation_id: String(created.id) });
    if (!result.id) throw new Error('publish_unknown');
    await patch({ status: 'published', publish_id: String(result.id), blocker: null });
    return { published: 1, content_id: record.id };
  } catch (error) { await patch({ status: 'publish_uncertain', blocker: error.message }); return { uncertain: 1 }; }
}
