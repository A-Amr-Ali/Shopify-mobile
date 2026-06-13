// Customer Account UI extension (vanilla JS — no React, so no react-reconciler
// dependency). Shows a Sofie Rewards card on the account portal's orders page:
// points + tier from our backend (session-token authed), plus a button to the
// full My Rewards hub.
import {
  extension,
  Card,
  BlockStack,
  Heading,
  Text,
  Button,
} from "@shopify/ui-extensions/customer-account";

const APP_URL = "https://shopify-mobile-production.up.railway.app";
const HUB_URL = "https://sofiestore.net/pages/my-rewards";
const TIER = { insider: "Insider", vip: "VIP", icon: "Icon" };

export default extension("customer-account.order-index.block.render", (root, api) => {
  const status = root.createText("Loading your rewards…");
  const sub = root.createText("");

  const card = root.createComponent(Card, { padding: true }, [
    root.createComponent(BlockStack, { spacing: "tight" }, [
      root.createComponent(Heading, { level: 2 }, "Sofie Rewards"),
      root.createComponent(Text, { emphasis: "bold" }, [status]),
      root.createComponent(Text, { appearance: "subdued" }, [sub]),
      root.createComponent(Button, { to: HUB_URL }, "Open My Rewards"),
    ]),
  ]);
  root.appendChild(card);
  root.mount();

  (async () => {
    try {
      const token = await api.sessionToken.get();
      const res = await fetch(`${APP_URL}/account-api/me?token=${encodeURIComponent(token)}`);
      if (!res.ok) throw new Error("request failed");
      const d = await res.json();
      status.updateText(`${d.balance} points · ${TIER[d.tier] || d.tier}`);
      sub.updateText(
        d.next ? `${d.to_next_egp} EGP more to reach ${TIER[d.next] || d.next}` : "You're at our top tier — thank you!"
      );
    } catch (e) {
      status.updateText("View your points and rewards in your account hub.");
    }
  })();
});
