import {
  reactExtension,
  useApi,
  BlockStack,
  Card,
  Heading,
  Text,
  Button,
} from "@shopify/ui-extensions-react/customer-account";
import { useEffect, useState } from "react";

// Where the app + full rewards hub live.
const APP_URL = "https://shopify-mobile-production.up.railway.app";
const HUB_URL = "https://sofiestore.net/pages/my-rewards";

export default reactExtension(
  "customer-account.order-index.block.render",
  () => <SofieRewards />
);

function SofieRewards() {
  const { sessionToken } = useApi();
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const token = await sessionToken.get();
        const res = await fetch(`${APP_URL}/account-api/me?token=${encodeURIComponent(token)}`);
        if (!res.ok) throw new Error("request failed");
        const json = await res.json();
        if (active) setData(json);
      } catch (e) {
        if (active) setError(true);
      }
    })();
    return () => { active = false; };
  }, []);

  const tierLabel = { insider: "Insider", vip: "VIP", icon: "Icon" };

  return (
    <Card padding>
      <BlockStack spacing="tight">
        <Heading level={2}>Sofie Rewards</Heading>
        {error ? (
          <Text>View your points and rewards in your account hub.</Text>
        ) : data ? (
          <BlockStack spacing="tight">
            <Text emphasis="bold">{data.balance} points · {tierLabel[data.tier] || data.tier}</Text>
            {data.next ? (
              <Text appearance="subdued">{data.to_next_egp} EGP more to reach {tierLabel[data.next] || data.next}</Text>
            ) : (
              <Text appearance="subdued">You're at our top tier — thank you!</Text>
            )}
          </BlockStack>
        ) : (
          <Text>Loading your rewards…</Text>
        )}
        <Button to={HUB_URL}>Open My Rewards</Button>
      </BlockStack>
    </Card>
  );
}
