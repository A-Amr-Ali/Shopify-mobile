// Create the customer metafield DEFINITIONS so balance/tier/spend show up as
// proper, typed fields in admin and are readable by the theme + Functions.
// Idempotent: "already taken" definitions are skipped, not errored. Runs once
// on app install via the afterAuth hook.
import { METAFIELDS } from "../config/loyalty.js";

const CREATE = `
  mutation CreateDef($def: MetafieldDefinitionInput!) {
    metafieldDefinitionCreate(definition: $def) {
      createdDefinition { id }
      userErrors { field message code }
    }
  }`;

const DEFINITIONS = [
  { name: "Loyalty Points", key: METAFIELDS.points.key, type: METAFIELDS.points.type },
  { name: "Loyalty Tier", key: METAFIELDS.tier.key, type: METAFIELDS.tier.type },
  { name: "Lifetime Spend (EGP)", key: METAFIELDS.spend.key, type: METAFIELDS.spend.type },
];

export async function ensureCustomerMetafieldDefinitions(admin) {
  for (const d of DEFINITIONS) {
    const def = {
      name: d.name,
      namespace: METAFIELDS.namespace,
      key: d.key,
      type: d.type,
      ownerType: "CUSTOMER",
      access: { admin: "MERCHANT_READ_WRITE", storefront: "PUBLIC_READ" },
    };
    try {
      const res = await admin.graphql(CREATE, { variables: { def } });
      const body = await res.json();
      const errs = body?.data?.metafieldDefinitionCreate?.userErrors ?? [];
      const fatal = errs.filter((e) => e.code !== "TAKEN");
      if (fatal.length) console.warn(`metafield def ${d.key}: ${JSON.stringify(fatal)}`);
    } catch (err) {
      console.warn(`metafield def ${d.key} failed: ${err.message}`);
    }
  }
}
