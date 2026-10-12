import { adminQuery } from './catalog.mjs';
import { recordRun } from './db.mjs';

const READ = `query GrowthWebhooks($uri: String!, $after: String) { webhookSubscriptions(first: 30, after: $after, uri: $uri) { nodes { id topic uri includeFields } pageInfo { hasNextPage endCursor } } }`;
const CREATE = `mutation GrowthWebhook($topic: WebhookSubscriptionTopic!, $subscription: WebhookSubscriptionInput!) { webhookSubscriptionCreate(topic: $topic, webhookSubscription: $subscription) { webhookSubscription { id topic uri includeFields } userErrors { field message } } }`;
const TOPICS = ['ORDERS_CREATE', 'ORDERS_UPDATED', 'ORDERS_CANCELLED'];
const FIELDS = ['id', 'note_attributes', 'updated_at', 'current_subtotal_price', 'subtotal_price', 'financial_status', 'fulfillment_status', 'currency', 'cancelled_at'];

// Register through the SAME Shopify app whose secret verifies signatures.
// Keep existing subscriptions and never request broader app access scopes.
export async function ensureOrderWebhooks() {
  const origin = process.env.PUBLIC_ORIGIN;
  if (!origin || !/^https:\/\//.test(origin)) return { state: 'unconfigured' };
  const uri = origin.replace(/\/$/, '') + '/webhooks/orders';
  const result = { state: 'ready', uri, subscriptions: [] };
  try {
    let after = null;
    const existing = [];
    do {
      const page = (await adminQuery(READ, { uri, after })).webhookSubscriptions;
      existing.push(...page.nodes);
      after = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
    } while (after);
    for (const topic of TOPICS) {
      let row = existing.find(x => x.topic === topic && x.uri === uri);
      if (!row) {
        const payload = (await adminQuery(CREATE, { topic, subscription: { uri, format: 'JSON', includeFields: FIELDS } })).webhookSubscriptionCreate;
        if (payload.userErrors.length) throw new Error(payload.userErrors.map(e => e.message).join('; ').slice(0,300));
        row = payload.webhookSubscription;
      }
      result.subscriptions.push({ id: row.id, topic: row.topic });
    }
  } catch (error) { result.state = 'needs_access'; result.error = error.message; }
  await recordRun('order_webhook_setup', result);
  return result;
}
