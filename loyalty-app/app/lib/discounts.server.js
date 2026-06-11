// Mint a unique, single-use, fixed-amount EGP discount code via the Admin API.
// Used by redemption: debit the ledger, then issue a code the customer applies
// at checkout. Restricted to the redeeming customer and usage-capped at 1.
import { REDEEM_CODE_PREFIX } from "../config/loyalty.js";
import crypto from "node:crypto";

const CREATE = `
  mutation CreateLoyaltyCode($basic: DiscountCodeBasicInput!) {
    discountCodeBasicCreate(basicCodeDiscount: $basic) {
      codeDiscountNode { id }
      userErrors { field message }
    }
  }`;

export function generateCode() {
  return REDEEM_CODE_PREFIX + crypto.randomBytes(4).toString("hex").toUpperCase();
}

/**
 * @param {object} admin       Shopify admin GraphQL client
 * @param {object} opts
 * @param {number} opts.amountEgp    fixed amount off, whole EGP
 * @param {string} opts.customerId   Shopify GID — restricts the code to them
 * @param {string} [opts.code]       explicit code (else generated)
 * @returns {{code:string, nodeId:string}}
 */
export async function mintDiscountCode(admin, { amountEgp, customerId, code }) {
  const finalCode = code || generateCode();
  const basic = {
    title: `Loyalty redemption ${finalCode}`,
    code: finalCode,
    startsAt: new Date().toISOString(),
    usageLimit: 1,
    appliesOncePerCustomer: true,
    customerSelection: { customers: { add: [customerId] } },
    customerGets: {
      value: { discountAmount: { amount: amountEgp, appliesOnEachItem: false } },
      items: { all: true },
    },
  };

  const res = await admin.graphql(CREATE, { variables: { basic } });
  const body = await res.json();
  const errs = body?.data?.discountCodeBasicCreate?.userErrors ?? [];
  if (errs.length) throw new Error(`discountCodeBasicCreate: ${JSON.stringify(errs)}`);
  return { code: finalCode, nodeId: body.data.discountCodeBasicCreate.codeDiscountNode.id };
}

/**
 * Mint a single-use code NOT tied to a specific customer (referral welcome gift,
 * birthday gift before the customer record exists). Usage-capped at 1.
 */
export async function mintOpenCode(admin, { amountEgp, code, prefix, days = 90 }) {
  const finalCode = code || (prefix || REDEEM_CODE_PREFIX) + crypto.randomBytes(4).toString("hex").toUpperCase();
  const endsAt = new Date(Date.now() + days * 864e5).toISOString();
  const basic = {
    title: `Loyalty code ${finalCode}`,
    code: finalCode,
    startsAt: new Date().toISOString(),
    endsAt,
    usageLimit: 1,
    customerSelection: { all: true },
    customerGets: {
      value: { discountAmount: { amount: amountEgp, appliesOnEachItem: false } },
      items: { all: true },
    },
  };
  const res = await admin.graphql(CREATE, { variables: { basic } });
  const body = await res.json();
  const errs = body?.data?.discountCodeBasicCreate?.userErrors ?? [];
  if (errs.length) throw new Error(`discountCodeBasicCreate(open): ${JSON.stringify(errs)}`);
  return { code: finalCode, nodeId: body.data.discountCodeBasicCreate.codeDiscountNode.id };
}

/**
 * Mint a single-use 100%-off code for ONE specific product (a points-redeemed
 * free gift). The customer adds that product to cart and the code makes it free.
 * @param {string} opts.productGid  gid://shopify/Product/123
 * @param {string} opts.customerId  Shopify GID — restricts the code to them
 */
export async function mintProductGiftCode(admin, { productGid, customerId, code }) {
  const finalCode = code || REDEEM_CODE_PREFIX + "GIFT-" + crypto.randomBytes(3).toString("hex").toUpperCase();
  const basic = {
    title: `Loyalty gift ${finalCode}`,
    code: finalCode,
    startsAt: new Date().toISOString(),
    usageLimit: 1,
    appliesOncePerCustomer: true,
    customerSelection: { customers: { add: [customerId] } },
    customerGets: {
      value: { percentage: 1.0 }, // 100% off → free
      items: { products: { productsToAdd: [productGid] } },
    },
  };
  const res = await admin.graphql(CREATE, { variables: { basic } });
  const body = await res.json();
  const errs = body?.data?.discountCodeBasicCreate?.userErrors ?? [];
  if (errs.length) throw new Error(`discountCodeBasicCreate(gift): ${JSON.stringify(errs)}`);
  return { code: finalCode, nodeId: body.data.discountCodeBasicCreate.codeDiscountNode.id };
}
