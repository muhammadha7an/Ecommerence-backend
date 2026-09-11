/*
 * Shared building blocks for every transactional email.
 * Inline styles only (email clients ignore <style> blocks). All dynamic values are escaped.
 */

const COLORS = {
  ink: "#1f2a27",
  clay: "#ad4b2f",
  clayLight: "#e0a58f",
  sage: "#dce2d6",
  sageSoft: "#eef1ea",
  text: "#33403c",
  muted: "#6b7672",
  line: "#e3e7df",
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/** Plain text with line breaks → safe HTML paragraphs. */
const paragraphs = (text) =>
  String(text || "")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map(
      (block) =>
        `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${COLORS.text};">${escapeHtml(block).replace(/\n/g, "<br>")}</p>`
    )
    .join("");

/** Replaces {{placeholders}} in admin-editable template text. */
const fillPlaceholders = (text, values = {}) =>
  String(text || "").replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) =>
    values[key] !== undefined && values[key] !== null ? String(values[key]) : match
  );

const formatMoney = (cents, currency = "usd") => {
  const amount = Number(cents || 0) / 100;
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: String(currency || "usd").toUpperCase() }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
};

const formatDate = (value) =>
  new Date(value || Date.now()).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const button = (href, label) =>
  href
    ? `<a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 24px;background:${COLORS.clay};color:#ffffff;text-decoration:none;border-radius:6px;font-weight:bold;font-size:14px;">${escapeHtml(label)}</a>`
    : "";

/** Two-column key/value table (order meta, contact details, etc.). */
const detailsTable = (rows) => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 20px;border:1px solid ${COLORS.line};border-radius:8px;">
    ${rows
      .filter((row) => row && row[1] !== undefined && row[1] !== null && row[1] !== "")
      .map(
        ([label, value], index) => `
      <tr>
        <td style="padding:10px 14px;font-size:13px;color:${COLORS.muted};width:38%;${index ? `border-top:1px solid ${COLORS.line};` : ""}">${escapeHtml(label)}</td>
        <td style="padding:10px 14px;font-size:14px;color:${COLORS.ink};font-weight:bold;${index ? `border-top:1px solid ${COLORS.line};` : ""}">${escapeHtml(value)}</td>
      </tr>`
      )
      .join("")}
  </table>`;

/** Order line items + subtotal / shipping / total. Amounts in cents. */
const orderSummaryTable = (order) => {
  const currency = order.currency || "usd";
  const items = Array.isArray(order.items) ? order.items : [];
  const subtotal =
    order.subtotalAmount ?? items.reduce((sum, item) => sum + Math.round(Number(item.price || 0) * 100) * Number(item.quantity || 1), 0);
  const shipping = order.shippingFee ?? 0;

  const rows = items
    .map(
      (item) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid ${COLORS.line};font-size:14px;color:${COLORS.ink};">
          ${escapeHtml(item.name)}<br>
          <span style="font-size:12px;color:${COLORS.muted};">${escapeHtml(item.quantity)} × ${formatMoney(Math.round(Number(item.price || 0) * 100), currency)}</span>
        </td>
        <td align="right" style="padding:10px 0;border-bottom:1px solid ${COLORS.line};font-size:14px;color:${COLORS.ink};font-weight:bold;white-space:nowrap;">
          ${formatMoney(Math.round(Number(item.price || 0) * 100) * Number(item.quantity || 1), currency)}
        </td>
      </tr>`
    )
    .join("");

  const totalRow = (label, value, strong) => `
      <tr>
        <td style="padding:6px 0;font-size:${strong ? 16 : 14}px;color:${strong ? COLORS.ink : COLORS.muted};${strong ? "font-weight:bold;" : ""}">${label}</td>
        <td align="right" style="padding:6px 0;font-size:${strong ? 16 : 14}px;color:${COLORS.ink};${strong ? "font-weight:bold;" : ""}">${value}</td>
      </tr>`;

  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 8px;">
    ${rows}
  </table>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 22px;">
    ${totalRow("Subtotal", formatMoney(subtotal, currency))}
    ${totalRow(escapeHtml(order.shippingMethod || "Shipping"), shipping > 0 ? formatMoney(shipping, currency) : "FREE")}
    ${totalRow("Total", formatMoney(order.totalAmount, currency), true)}
  </table>`;
};

const formatAddress = (address) => {
  if (!address) return "";
  if (typeof address === "string") return address;
  return [address.line1, address.line2, address.city, address.state, address.postal_code, address.country]
    .filter(Boolean)
    .join(", ");
};

const shortOrderId = (order) => `#${String(order?._id || order?.id || "").slice(-8).toUpperCase()}`;

/** Wraps content in the branded email shell. */
const renderLayout = ({ storeName = "Aura", preheader = "", heading = "", body = "", footer = "" }) => `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(heading || storeName)}</title>
  </head>
  <body style="margin:0;padding:0;background:${COLORS.sageSoft};">
    <span style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</span>
    <div style="padding:32px 16px;background:${COLORS.sageSoft};font-family:Arial,Helvetica,sans-serif;color:${COLORS.ink};">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid ${COLORS.sage};border-radius:14px;overflow:hidden;">
        <div style="padding:24px 32px;background:${COLORS.ink};">
          <span style="font-family:Georgia,'Times New Roman',serif;font-size:26px;color:#ffffff;">${escapeHtml(storeName)}<span style="color:${COLORS.clayLight};">.</span></span>
        </div>
        <div style="padding:32px;">
          ${heading ? `<h1 style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:normal;line-height:1.3;color:${COLORS.ink};">${escapeHtml(heading)}</h1>` : ""}
          ${body}
        </div>
        <div style="padding:18px 32px;border-top:1px solid ${COLORS.sageSoft};font-size:12px;line-height:1.5;color:#87918d;">
          ${footer || `This email was sent by ${escapeHtml(storeName)}.`}
        </div>
      </div>
    </div>
  </body>
</html>`;

module.exports = {
  COLORS,
  escapeHtml,
  paragraphs,
  fillPlaceholders,
  formatMoney,
  formatDate,
  formatAddress,
  shortOrderId,
  button,
  detailsTable,
  orderSummaryTable,
  renderLayout,
};
