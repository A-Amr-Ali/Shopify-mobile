// Minimal Klaviyo Events API push (Phase 1: points earned / tier upgraded /
// reward available). Fire-and-forget; never block the webhook on Klaviyo.
const BASE = "https://a.klaviyo.com/api/events/";
const REVISION = "2024-10-15";

/**
 * @param {string} metric  e.g. "Loyalty Points Earned"
 * @param {string} email   customer email (Klaviyo profile key)
 * @param {object} properties  event payload
 */
export async function trackEvent(metric, email, properties = {}) {
  const key = process.env.KLAVIYO_API_KEY;
  if (!key || !email) return; // soft no-op when unconfigured

  const body = {
    data: {
      type: "event",
      attributes: {
        properties,
        metric: { data: { type: "metric", attributes: { name: metric } } },
        profile: { data: { type: "profile", attributes: { email } } },
        time: new Date().toISOString(),
      },
    },
  };

  try {
    const res = await fetch(BASE, {
      method: "POST",
      headers: {
        Authorization: `Klaviyo-API-Key ${key}`,
        revision: REVISION,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) console.warn(`Klaviyo event ${metric} → HTTP ${res.status}: ${await res.text()}`);
  } catch (err) {
    console.warn(`Klaviyo event ${metric} failed: ${err.message}`);
  }
}
