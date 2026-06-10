// Shopify app (shopify-app-remix). Provides authenticated admin/webhook/proxy
// contexts. OAuth sessions persist in Supabase so tokens survive Railway's
// ephemeral containers.
import "@shopify/shopify-app-remix/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-remix/server";
import { SupabaseSessionStorage } from "./lib/session-storage.server.js";
import { ensureCustomerMetafieldDefinitions } from "./lib/metafield-definitions.server.js";

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.October24,
  scopes: (process.env.SCOPES || "").split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: new SupabaseSessionStorage(),
  distribution: AppDistribution.AppStore,
  webhooks: {
    ORDERS_PAID: { deliveryMethod: "http", callbackUrl: "/webhooks" },
    REFUNDS_CREATE: { deliveryMethod: "http", callbackUrl: "/webhooks" },
    ORDERS_CANCELLED: { deliveryMethod: "http", callbackUrl: "/webhooks" },
    CUSTOMERS_CREATE: { deliveryMethod: "http", callbackUrl: "/webhooks" },
  },
  hooks: {
    // On install/reauth: register webhooks and ensure customer metafield defs.
    afterAuth: async ({ session, admin }) => {
      await shopify.registerWebhooks({ session });
      try {
        await ensureCustomerMetafieldDefinitions(admin);
      } catch (err) {
        console.warn(`metafield definition bootstrap skipped: ${err.message}`);
      }
    },
  },
  future: { unstable_newEmbeddedAuthStrategy: true },
});

export default shopify;
export const apiVersion = ApiVersion.October24;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const registerWebhooks = shopify.registerWebhooks;
