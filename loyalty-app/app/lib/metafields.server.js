// Mirror summary fields into Shopify customer metafields so the theme + Shopify
// Functions can read balance/tier/spend without hitting our backend.
import { METAFIELDS } from "../config/loyalty.js";

const MUTATION = `
  mutation SetLoyaltyMetafields($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields { id key namespace }
      userErrors { field message }
    }
  }`;

/**
 * @param {object} admin  Shopify admin GraphQL client (admin.graphql)
 * @param {string} customerId  Shopify GID
 * @param {{points:number, tier:string, spend:number}} summary
 */
export async function mirrorCustomer(admin, customerId, { points, tier, spend }) {
  const ns = METAFIELDS.namespace;
  const metafields = [
    { ownerId: customerId, namespace: ns, key: METAFIELDS.points.key, type: METAFIELDS.points.type, value: String(points ?? 0) },
    { ownerId: customerId, namespace: ns, key: METAFIELDS.tier.key, type: METAFIELDS.tier.type, value: String(tier ?? "insider") },
    { ownerId: customerId, namespace: ns, key: METAFIELDS.spend.key, type: METAFIELDS.spend.type, value: String(spend ?? 0) },
  ];

  const res = await admin.graphql(MUTATION, { variables: { metafields } });
  const body = await res.json();
  const errs = body?.data?.metafieldsSet?.userErrors ?? [];
  if (errs.length) throw new Error(`metafieldsSet: ${JSON.stringify(errs)}`);
  return body.data.metafieldsSet.metafields;
}
