const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
export const configured = Boolean(url && key);
export async function db(path, { method = 'GET', body, prefer = 'return=representation' } = {}) {
  if (!configured) throw new Error('database_unconfigured');
  const r = await fetch(url + '/rest/v1/' + path, { method, signal: AbortSignal.timeout(10000),
    headers: { apikey: key, authorization: 'Bearer ' + key, 'content-type': 'application/json', Prefer: prefer },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  if (!r.ok) throw new Error('database_' + r.status);
  const text = await r.text(); return text ? JSON.parse(text) : null;
}
export async function takeBudget(scope, actor, cap, seconds = 3600) {
  if (!configured) return false;
  const out = await db('rpc/growth_take_budget', { method: 'POST', body: { p_scope: scope, p_actor: actor, p_cap: cap, p_seconds: seconds } });
  return out === true;
}
export async function recordRun(kind, summary) {
  await db('growth_runs', { method: 'POST', body: { kind, summary } });
}
