import { db, recordRun } from './db.mjs';
import { loadCatalog } from './catalog.mjs';
import { cleanProfile, chooseRoutine } from './engine.mjs';
import { publishDueContent, publishingConfigured } from './publisher.mjs';
import { END } from './config.mjs';
let running = false;
export async function runGrowth() {
  if (running) return { skipped: 'already_running' };
  if (Date.now() > Date.parse(END + 'T23:59:59+02:00')) return { skipped: 'campaign_ended' };
  running = true;
  const summary = { prepared: 0, stock_held: 0, missing_assets: 0, account_connected: publishingConfigured() };
  try {
    const until = new Date(Date.now() + 48 * 3600000).toISOString();
    const since = new Date(Date.now() - 24 * 3600000).toISOString();
    const rows = await db('growth_content?status=in.(draft,blocked,ready)&scheduled_for=gte.' + encodeURIComponent(since) + '&scheduled_for=lte.' + encodeURIComponent(until) + '&order=scheduled_for.asc&limit=12');
    for (const row of rows || []) {
      const profile = cleanProfile({ goal: row.goal, budget: row.metadata?.budget || 10000 });
      const catalog = await loadCatalog(profile.goal, { fresh: true });
      const routine = chooseRoutine(catalog.cards, profile);
      const missing = !routine.items.length;
      const readyAsset = Boolean(row.asset_url && row.asset_status === 'ready' && row.metadata?.claims_checked === true);
      // A finished asset refers to a fixed set of products. Never silently swap
      // different products underneath an already generated video or image.
      const assetUnavailable = readyAsset && (row.variant_ids || []).some(id => !catalog.cards.some(c => c.variantId === String(id)));
      const status = missing || assetUnavailable ? 'held_stock' : readyAsset && publishingConfigured() ? 'ready' : 'blocked';
      const blocker = missing || assetUnavailable ? 'Featured options are unavailable; replace the asset before publishing.'
        : !readyAsset ? 'Finished asset and claim checks needed.' : !publishingConfigured() ? 'Instagram connection needed.' : null;
      const fields = { status, blocker, updated_at: new Date().toISOString(), metadata: { ...row.metadata, stock_verified_at: new Date().toISOString(), stock_verification: catalog.verification } };
      if (!readyAsset) { fields.product_handles = routine.items.map(p => p.handle); fields.variant_ids = routine.items.map(p => p.variantId); }
      await db('growth_content?id=eq.' + encodeURIComponent(row.id), { method: 'PATCH', body: fields });
      if (missing || assetUnavailable) summary.stock_held++; else summary.prepared++;
      if (!readyAsset) summary.missing_assets++;
    }
    summary.publisher = await publishDueContent();
    await recordRun('growth_queue', summary);
    return summary;
  } catch (error) {
    summary.error = error.message;
    try { await recordRun('growth_queue_error', summary); } catch { /* don't hide original error */ }
    return summary;
  } finally { running = false; }
}
