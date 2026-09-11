const { paragraphs, fillPlaceholders, detailsTable, renderLayout, formatDate, escapeHtml, COLORS } = require("./layout");

const defaults = {
  subject: "We received your message: {{subject}}",
  heading: "Thanks for reaching out, {{name}}",
  message: "We've received your message and our team will get back to you within one business day.\n\nFor reference, here is a copy of what you sent.",
};

const quote = (text) =>
  `<div style="margin:0 0 20px;padding:14px 16px;border-left:3px solid ${COLORS.clay};background:${COLORS.sageSoft};font-size:14px;line-height:1.6;color:${COLORS.text};white-space:pre-wrap;">${escapeHtml(text)}</div>`;

/** Confirmation to the person who submitted the form. */
const customer = (submission, ctx) => {
  const values = { name: submission.name, subject: submission.subject, storeName: ctx.storeName };
  const t = { ...defaults, ...Object.fromEntries(Object.entries(ctx.template || {}).filter(([, v]) => v)) };
  const heading = fillPlaceholders(t.heading, values);

  return {
    subject: fillPlaceholders(t.subject, values),
    html: renderLayout({
      storeName: ctx.storeName,
      preheader: "We received your message",
      heading,
      body: `${paragraphs(fillPlaceholders(t.message, values))}${detailsTable([["Subject", submission.subject]])}${quote(submission.message)}`,
    }),
    text: `${heading}\n\nWe received your message "${submission.subject}".`,
  };
};

/** Full submission to the store admin. */
const admin = (submission, ctx) => ({
  subject: `New contact message: ${submission.subject}`,
  html: renderLayout({
    storeName: ctx.storeName,
    preheader: `Message from ${submission.name}`,
    heading: "New contact form message",
    body: `${detailsTable([
      ["Name", submission.name],
      ["Email", submission.email],
      ["Subject", submission.subject],
      ["Received", formatDate(submission.createdAt)],
    ])}${quote(submission.message)}${paragraphs("Reply directly to this email to answer the customer.")}`,
  }),
  text: `From: ${submission.name} <${submission.email}>\nSubject: ${submission.subject}\n\n${submission.message}`,
  replyTo: submission.email,
});

module.exports = { defaults, customer, admin };
