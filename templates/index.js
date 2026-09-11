const orderCreated = require("./orderCreated");
const orderStatusChanged = require("./orderStatusChanged");
const newUser = require("./newUser");
const contactForm = require("./contactForm");
const newsletter = require("./newsletter");

/** Registry used by emailService and by the admin Settings page (defaults + placeholders). */
const templates = {
  orderCreated: {
    label: "New order",
    description: "Sent to the customer after a successful payment. The admin always receives a detailed copy.",
    placeholders: ["name", "orderId", "storeName"],
    module: orderCreated,
  },
  orderStatusChanged: {
    label: "Order status changed",
    description: "Sent to the customer when an admin changes the order status.",
    placeholders: ["name", "orderId", "status", "statusMessage", "storeName"],
    module: orderStatusChanged,
  },
  newUser: {
    label: "New user welcome",
    description: "Sent when a customer creates an account. Passwords are never included.",
    placeholders: ["name", "email", "storeName"],
    module: newUser,
  },
  contactForm: {
    label: "Contact form confirmation",
    description: "Sent to the visitor after they submit the contact form. The admin always receives the full message.",
    placeholders: ["name", "subject", "storeName"],
    module: contactForm,
  },
  newsletter: {
    label: "Newsletter subscription",
    description: "Sent to new newsletter subscribers.",
    placeholders: ["email", "storeName"],
    module: newsletter,
  },
};

const templateCatalog = () =>
  Object.entries(templates).map(([key, t]) => ({
    key,
    label: t.label,
    description: t.description,
    placeholders: t.placeholders,
    defaults: t.module.defaults,
  }));

module.exports = { templates, templateCatalog };
