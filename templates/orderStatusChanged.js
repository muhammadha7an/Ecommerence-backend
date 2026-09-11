const {
  paragraphs, fillPlaceholders, shortOrderId, detailsTable, orderSummaryTable, renderLayout, button,
} = require("./layout");

const defaults = {
  subject: "Your order {{orderId}} is now {{status}}",
  heading: "Your order is {{status}}",
  message: "Hi {{name}},\n\n{{statusMessage}}",
};

const STATUS_MESSAGES = {
  pending: "Your order has been received and is waiting to be processed.",
  processing: "Good news — we're preparing your order now.",
  shipped: "Your order is on its way. It should arrive soon.",
  delivered: "Your order has been delivered. We hope you love it!",
  cancelled: "Your order has been cancelled. If you have questions about a refund, just reply to this email.",
};

const label = (status) => String(status || "").replace(/^\w/, (c) => c.toUpperCase());

const customer = (order, ctx) => {
  const status = String(order.orderStatus || "").toLowerCase();
  const values = {
    name: order.shippingDetails?.fullName || order.userId?.name || "there",
    orderId: shortOrderId(order),
    status: label(status),
    statusMessage: STATUS_MESSAGES[status] || `Your order status is now ${label(status)}.`,
    storeName: ctx.storeName,
  };
  const t = { ...defaults, ...Object.fromEntries(Object.entries(ctx.template || {}).filter(([, v]) => v)) };
  const heading = fillPlaceholders(t.heading, values);

  const body = `
    ${paragraphs(fillPlaceholders(t.message, values))}
    ${detailsTable([
      ["Order ID", values.orderId],
      ["Previous status", ctx.previousStatus ? label(ctx.previousStatus) : ""],
      ["New status", values.status],
    ])}
    ${orderSummaryTable(order)}
    ${ctx.frontendUrl ? button(`${ctx.frontendUrl}/dashboard/orders/${order._id}`, "Track your order") : ""}
  `;

  return {
    subject: fillPlaceholders(t.subject, values),
    html: renderLayout({ storeName: ctx.storeName, preheader: `Order ${values.orderId}: ${values.status}`, heading, body }),
    text: `${heading}\n\n${values.statusMessage}`,
  };
};

module.exports = { defaults, customer, STATUS_MESSAGES };
