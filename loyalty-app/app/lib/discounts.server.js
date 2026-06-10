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
