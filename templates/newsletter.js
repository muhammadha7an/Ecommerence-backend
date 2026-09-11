const { paragraphs, fillPlaceholders, renderLayout, button } = require("./layout");

const defaults = {
  subject: "Welcome to the {{storeName}} newsletter",
  heading: "You're on the list.",
  message: "Thank you for subscribing to our newsletter. You'll be first to hear about new releases, restocks and styling notes.\n\nWe only send emails worth opening, and never share your address.",
};

const customer = (subscriber, ctx) => {
  const values = { email: subscriber.email, storeName: ctx.storeName };
  const t = { ...defaults, ...Object.fromEntries(Object.entries(ctx.template || {}).filter(([, v]) => v)) };
  const heading = fillPlaceholders(t.heading, values);

  return {
    subject: fillPlaceholders(t.subject, values),
    html: renderLayout({
      storeName: ctx.storeName,
      preheader: "Thanks for subscribing",
      heading,
      body: `${paragraphs(fillPlaceholders(t.message, values))}${ctx.frontendUrl ? button(`${ctx.frontendUrl}/shop`, "Browse the shop") : ""}`,
      footer: "You received this email because this address was subscribed on our website. If this wasn't you, you can ignore this message.",
    }),
    text: `${heading}\n\n${fillPlaceholders(t.message, values)}`,
  };
};

module.exports = { defaults, customer };
