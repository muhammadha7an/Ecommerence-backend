const {
  paragraphs, fillPlaceholders, formatDate, formatAddress, shortOrderId,
  detailsTable, orderSummaryTable, renderLayout, button, escapeHtml,
} = require("./layout");

const defaults = {
  subject: "Order {{orderId}} confirmed — thank you, {{name}}",
  heading: "Thank you for your order",
  message: "Hi {{name}},\n\nWe've received your order and it's now being prepared. We'll email you again as soon as its status changes.",
};

const customerName = (order) => order.shippingDetails?.fullName || order.customerName || "there";

/** Email to the customer. `ctx` = { storeName, template, frontendUrl } */
const customer = (order, ctx) => {
  const values = { name: customerName(order), orderId: shortOrderId(order), storeName: ctx.storeName };
  const t = { ...defaults, ...Object.fromEntries(Object.entries(ctx.template || {}).filter(([, v]) => v)) };
  const heading = fillPlaceholders(t.heading, values);

  const body = `
    ${paragraphs(fillPlaceholders(t.message, values))}
    ${detailsTable([
      ["Order ID", values.orderId],
      ["Order date", formatDate(order.createdAt)],
      ["Status", String(order.orderStatus || "processing").replace(/^\w/, (c) => c.toUpperCase())],
      ["Ship to", [order.shippingDetails?.fullName, formatAddress(order.shippingDetails?.address)].filter(Boolean).join(" — ")],
    ])}
    ${orderSummaryTable(order)}
    ${ctx.frontendUrl ? button(`${ctx.frontendUrl}/dashboard/orders/${order._id}`, "View your order") : ""}
  `;

  return {
    subject: fillPlaceholders(t.subject, values),
    html: renderLayout({ storeName: ctx.storeName, preheader: `Order ${values.orderId} confirmed`, heading, body }),
    text: `${heading}\n\nOrder ${values.orderId} — total ${(order.totalAmount / 100).toFixed(2)} ${String(order.currency || "usd").toUpperCase()}.`,
  };
};

/** Internal notification to the store admin (not editable — always detailed). */
const admin = (order, ctx) => {
  const orderId = shortOrderId(order);
  const issues = Array.isArray(order.inventoryIssues) ? order.inventoryIssues : [];

  const body = `
    ${paragraphs(`A new paid order was placed by ${customerName(order)}.`)}
    ${issues.length ? `<p style="margin:0 0 14px;padding:12px 14px;border-radius:8px;background:#fdf1dc;color:#7a4f0c;font-size:14px;"><strong>Stock warning:</strong> ${issues
      .map((i) => `${escapeHtml(i.name)} (ordered ${escapeHtml(i.requested)}, only ${escapeHtml(i.available)} available)`)
      .join("; ")}</p>` : ""}
    ${detailsTable([
      ["Order ID", orderId],
      ["Date", formatDate(order.createdAt)],
      ["Customer", order.shippingDetails?.fullName],
      ["Email", order.shippingDetails?.email],
      ["Phone", order.shippingDetails?.phone],
      ["Address", formatAddress(order.shippingDetails?.address)],
      ["Payment", order.paymentStatus],
    ])}
    ${orderSummaryTable(order)}
    ${ctx.frontendUrl ? button(`${ctx.frontendUrl}/admin/orders`, "Open orders") : ""}
  `;

  return {
    subject: `New order ${orderId} — ${(order.totalAmount / 100).toFixed(2)} ${String(order.currency || "usd").toUpperCase()}`,
    html: renderLayout({ storeName: ctx.storeName, preheader: `New order ${orderId}`, heading: "New order received", body }),
    text: `New order ${orderId} from ${customerName(order)}.`,
  };
};

module.exports = { defaults, customer, admin };
