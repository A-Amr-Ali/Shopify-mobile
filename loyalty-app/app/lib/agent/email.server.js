// Render a complete, email-client-safe HTML email server-side, so Klaviyo only
// needs a one-line HTML block ({{ event.html }}) with no design work. The subject
// and body come from the AI (English); products are the resolved catalog cards.
// Unsubscribe is added by Klaviyo's own footer block (managed per-recipient), not
// here.
import { EMAIL } from "../../config/brand-voice.js";

const esc = (s) => String(s ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function logo() {
  const { logoUrl, ink, storeUrl } = EMAIL;
  const inner = logoUrl
    ? `<img src="${esc(logoUrl)}" alt="Sofie" width="120" style="display:block;border:0;max-height:42px;width:auto;margin:0 auto;" />`
    : `<span style="color:${ink};letter-spacing:.32em;font-size:20px;text-transform:uppercase;">Sofie</span>`;
  return `<a href="${esc(storeUrl)}" style="text-decoration:none;color:${ink};">${inner}</a>`;
}

function productRows(products = []) {
  if (!products.length) return "";
  const { storeUrl, cream } = EMAIL;
  const rows = products.map((p) => {
    const url = `${storeUrl}/products/${esc(p.handle)}`;
    const img = p.image ? esc(p.image) : "";
    return `
      <tr><td style="padding:10px 12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #ece6df;border-radius:14px;overflow:hidden;">
          <tr>
            <td width="92" style="padding:12px;" valign="middle">
              <a href="${url}"><img src="${img}" alt="${esc(p.title)}" width="68" height="68" style="display:block;border:0;width:68px;height:68px;object-fit:cover;border-radius:10px;background:${cream};" /></a>
            </td>
            <td valign="middle" style="padding:12px 14px 12px 0;" dir="auto">
              <a href="${url}" style="display:block;color:#2a201d;font-size:15px;line-height:1.4;text-decoration:none;margin:0 0 5px;font-family:Georgia,'Times New Roman',serif;">${esc(p.title)}</a>
              <span style="color:#6b625c;font-size:14px;letter-spacing:.02em;">${esc(p.price)} EGP</span>
            </td>
            <td width="92" valign="middle" align="right" style="padding:12px 16px 12px 0;">
              <a href="${url}" style="display:inline-block;border:1px solid #c9a96a;color:#2a201d;font-size:11px;letter-spacing:.12em;text-transform:uppercase;text-decoration:none;padding:9px 16px;border-radius:999px;">View</a>
            </td>
          </tr>
        </table>
      </td></tr>`;
  }).join("");
  return `
    <tr><td style="padding:30px 40px 4px 40px;" dir="auto"><p style="margin:0;color:#9a8f88;font-size:12px;letter-spacing:.18em;text-transform:uppercase;">Chosen for you</p></td></tr>
    <tr><td style="padding:8px 28px 8px 28px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table></td></tr>`;
}

/**
 * @param {{subject:string, preview?:string, body:string, products?:Array}} m
 * @returns {string} full HTML email
 */
// Shared luxury shell: logo band + content rows + sign-off + footer.
function shell(contentHtml, preheader) {
  const { gold, page, storeUrl, fromName, footerLocation, unsubscribeEmail, headerBg } = EMAIL;
  const unsub = unsubscribeEmail
    ? `<br><a href="mailto:${esc(unsubscribeEmail)}?subject=Unsubscribe" style="color:#b3aaa3;text-decoration:underline;">Unsubscribe</a>`
    : "";
  return `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader || "A little note from Sofie")}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${page};margin:0;padding:0;">
  <tr><td align="center" style="padding:28px 12px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#ffffff;border-radius:18px;overflow:hidden;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
      <tr><td align="center" style="background:${headerBg};padding:22px 24px;">${logo()}</td></tr>
      <tr><td style="height:3px;background:${gold};line-height:3px;font-size:0;">&nbsp;</td></tr>
      ${contentHtml}
      <tr><td style="padding:28px 40px 4px;" align="center"><p style="margin:0;color:#9a8f88;font-size:11px;letter-spacing:.16em;text-transform:uppercase;">100% Authentic&nbsp;&nbsp;·&nbsp;&nbsp;Fast Delivery Across Egypt&nbsp;&nbsp;·&nbsp;&nbsp;Secure Checkout</p></td></tr>
      <tr><td style="padding:18px 40px 0;"><div style="height:1px;background:#ece6df;line-height:1px;font-size:0;">&nbsp;</div></td></tr>
      <tr><td style="padding:20px 40px 6px;" dir="auto"><p style="margin:0;color:#3a302c;font-size:15px;line-height:1.7;">With love,<br><span style="color:${gold};letter-spacing:.06em;">${esc(fromName)}</span></p></td></tr>
      <tr><td style="padding:18px 40px 30px;" align="center"><p style="margin:0;color:#9a8f88;font-size:12px;line-height:1.7;">Sofie · ${esc(footerLocation)}<br><a href="${storeUrl}" style="color:#9a8f88;text-decoration:underline;">${esc(storeUrl.replace(/^https?:\/\//, ""))}</a>${unsub}</p></td></tr>
    </table>
  </td></tr>
</table>`;
}

export function renderEmail(m) {
  const { ink, gold, storeUrl } = EMAIL;
  const products = Array.isArray(m.products) ? m.products : [];
  const cta = products[0] ? `${storeUrl}/products/${esc(products[0].handle)}` : storeUrl;
  const bodyHtml = esc(m.body).replace(/\n/g, "<br>");
  const content = `
      <tr><td style="padding:34px 40px 6px 40px;" dir="auto">
        <p style="margin:0 0 8px;color:${gold};font-size:12px;letter-spacing:.2em;text-transform:uppercase;">A note from Sofie</p>
        <h1 style="margin:0;color:${ink};font-size:27px;line-height:1.3;font-weight:400;font-family:Georgia,'Times New Roman',serif;">${esc(m.subject || "Something caught your eye")}</h1>
      </td></tr>
      <tr><td style="padding:14px 40px 8px 40px;" dir="auto"><div style="color:#3a302c;font-size:16px;line-height:1.8;">${bodyHtml}</div></td></tr>
      <tr><td align="center" style="padding:22px 40px 6px 40px;">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr><td align="center" bgcolor="${ink}" style="border-radius:999px;">
          <a href="${cta}" style="display:inline-block;padding:14px 38px;color:#ffffff;font-size:13px;letter-spacing:.16em;text-transform:uppercase;text-decoration:none;border-radius:999px;">Discover</a>
        </td></tr></table>
      </td></tr>
      ${productRows(products)}`;
  return shell(content, m.preview);
}

/**
 * Birthday gift email. gift = { firstName, code, egp, note }.
 * @returns {string} full HTML email
 */
export function renderBirthdayEmail(gift = {}) {
  const { ink, gold, storeUrl } = EMAIL;
  const name = gift.firstName ? `, ${esc(gift.firstName)}` : "";
  const codeBox = gift.code
    ? `<tr><td align="center" style="padding:6px 40px 6px;">
        <div style="display:inline-block;border:1px dashed ${gold};border-radius:12px;padding:14px 26px;text-align:center;">
          <div style="font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#9a8f88;margin-bottom:4px;">Your gift code</div>
          <div style="font-size:22px;letter-spacing:.08em;color:${ink};">${esc(gift.code)}</div>
          <div style="font-size:13px;color:#6b625c;margin-top:4px;">${esc(gift.egp)} EGP off your next order</div>
        </div>
      </td></tr>`
    : "";
  const giftLine = gift.code
    ? `Enjoy <strong>${esc(gift.egp)} EGP off</strong> — our gift to you, to use on your next order.`
    : `Your birthday treat: ${esc(gift.note || "a little something with your next order this month.")}`;
  const content = `
      <tr><td style="padding:34px 40px 6px 40px;" dir="auto">
        <p style="margin:0 0 8px;color:${gold};font-size:12px;letter-spacing:.2em;text-transform:uppercase;">Happy Birthday</p>
        <h1 style="margin:0;color:${ink};font-size:27px;line-height:1.3;font-weight:400;font-family:Georgia,'Times New Roman',serif;">Happy birthday${name} 🎉</h1>
      </td></tr>
      <tr><td style="padding:14px 40px 14px 40px;" dir="auto"><div style="color:#3a302c;font-size:16px;line-height:1.8;">Wishing you a beautiful day from all of us at Sofie. ${giftLine}</div></td></tr>
      ${codeBox}
      <tr><td align="center" style="padding:18px 40px 6px 40px;">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr><td align="center" bgcolor="${ink}" style="border-radius:999px;">
          <a href="${storeUrl}" style="display:inline-block;padding:14px 34px;color:#ffffff;font-size:15px;letter-spacing:.04em;text-decoration:none;border-radius:999px;">Treat Yourself</a>
        </td></tr></table>
      </td></tr>`;
  return shell(content, "A birthday treat from Sofie 🎉");
}
