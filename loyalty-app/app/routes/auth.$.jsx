// OAuth handler — delegates to shopify-app-remix.
import { authenticate } from "../shopify.server.js";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return null;
};
