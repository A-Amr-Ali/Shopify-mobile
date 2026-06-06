// Official brand sites to watch for new arrivals.
// platform "shopify" → we can read its public /products.json feed.
// platform "unsupported" → not on a readable platform (e.g. Salesforce
// Commerce Cloud); we skip it and tell you, rather than pretend.
//
// ⚠️ Domains/platforms are best guesses — verify and edit freely. The reader
// degrades gracefully: any brand that blocks us or isn't Shopify is skipped
// with a warning, and the rest still work.
export const BRAND_SOURCES = [
  { name: "Rhode", domain: "rhode.com", platform: "shopify" },
  { name: "Rare Beauty", domain: "rarebeauty.com", platform: "shopify" },
  { name: "Makeup by Mario", domain: "makeupbymario.com", platform: "shopify" },
  { name: "Patrick Ta", domain: "patrickta.com", platform: "shopify" },
  { name: "Summer Fridays", domain: "summerfridays.com", platform: "shopify" },
  { name: "Saie", domain: "saiehello.com", platform: "shopify" },
  { name: "Glossier", domain: "glossier.com", platform: "shopify" },
  { name: "Kosas", domain: "kosas.com", platform: "shopify" },

  // Not readable via a public product feed — handle these manually.
  { name: "Charlotte Tilbury", domain: "charlottetilbury.com", platform: "unsupported" },
  { name: "NARS", domain: "narscosmetics.com", platform: "unsupported" },
  { name: "Laura Mercier", domain: "lauramercier.com", platform: "unsupported" },
  { name: "Hourglass", domain: "hourglasscosmetics.com", platform: "unsupported" },
  { name: "Huda Beauty", domain: "hudabeauty.com", platform: "unsupported" },
];
