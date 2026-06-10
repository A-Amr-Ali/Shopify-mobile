// Shopify app (shopify-app-remix). Provides authenticated admin/webhook/proxy
// contexts. Sessions are stored in Supabase via a custom session storage in a
// later step; for Phase 1 we use the in-memory storage to get dev running.
import "@shopify/shopify-app-remix/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-remix/server";

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.October24,
  scopes: (process.env.SCOPES || "").split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  distribution: AppDistribution.AppStore,
  webhooks: {
    ORDERS_PAID: { deliveryMethod: "http", callbackUrl: "/webhooks" },
    REFUNDS_CREATE: { deliveryMethod: "http", callbackUrl: "/webhooks" },
    ORDERS_CANCELLED: { deliveryMethod: "http", callbackUrl: "/webhooks" },
  },
  future: { unstable_newEmbeddedAuthStrategy: true },
});

export default shopify;
export const apiVersion = ApiVersion.October24;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const registerWebhooks = shopify.registerWebhooks;
