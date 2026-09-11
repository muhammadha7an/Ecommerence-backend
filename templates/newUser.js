const { paragraphs, fillPlaceholders, detailsTable, renderLayout, button } = require("./layout");

const defaults = {
  subject: "Welcome to {{storeName}}, {{name}}",
  heading: "Welcome, {{name}}",
  message: "Thanks for creating an account with {{storeName}}.\n\nYou can now track your orders, save favourites to your wishlist and check out faster.",
};

/** Welcome email. Never includes the password or any token. */
const customer = (user, ctx) => {
  const values = { name: user.name || "there", email: user.email, storeName: ctx.storeName };
  const t = { ...defaults, ...Object.fromEntries(Object.entries(ctx.template || {}).filter(([, v]) => v)) };
  const heading = fillPlaceholders(t.heading, values);

  const body = `
    ${paragraphs(fillPlaceholders(t.message, values))}
    ${detailsTable([
      ["Name", user.name],
      ["Account email", user.email],
    ])}
    ${ctx.frontendUrl ? button(`${ctx.frontendUrl}/shop`, "Start shopping") : ""}
  `;

  return {
    subject: fillPlaceholders(t.subject, values),
    html: renderLayout({
      storeName: ctx.storeName,
      preheader: `Your ${ctx.storeName} account is ready`,
      heading,
      body,
      footer: "You received this email because an account was created with this address. If this wasn't you, please contact us.",
    }),
    text: `${heading}\n\nYour account (${user.email}) is ready.`,
  };
};

module.exports = { defaults, customer };
