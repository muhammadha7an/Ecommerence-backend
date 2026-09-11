/*
 * Shipping calculation — the single source of truth.
 * Works in integer cents so $77.99 vs $78.00 comparisons are exact.
 * The frontend mirrors this logic for display only; checkout always uses this file.
 */

const DEFAULT_SHIPPING = Object.freeze({
  freeShippingThreshold: 78,
  shippingFee: 10,
  methodName: "Standard shipping",
});

const toCents = (dollars) => Math.round(Number(dollars || 0) * 100);

const normalizeShippingSettings = (shipping = {}) => {
  const threshold = Number(shipping.freeShippingThreshold);
  const fee = Number(shipping.shippingFee);

  return {
    freeShippingThreshold: Number.isFinite(threshold) && threshold >= 0 ? threshold : DEFAULT_SHIPPING.freeShippingThreshold,
    shippingFee: Number.isFinite(fee) && fee >= 0 ? fee : DEFAULT_SHIPPING.shippingFee,
    methodName: String(shipping.methodName || DEFAULT_SHIPPING.methodName).trim() || DEFAULT_SHIPPING.methodName,
  };
};

/**
 * @param {number} subtotalCents  cart subtotal in cents (already validated against the DB)
 * @param {object} shippingSettings  { freeShippingThreshold, shippingFee, methodName } in dollars
 */
const calculateShipping = (subtotalCents, shippingSettings) => {
  const settings = normalizeShippingSettings(shippingSettings);
  const subtotal = Math.max(0, Math.round(Number(subtotalCents) || 0));
  const thresholdCents = toCents(settings.freeShippingThreshold);
  const feeCents = toCents(settings.shippingFee);

  const isFree = feeCents === 0 || subtotal >= thresholdCents;
  const shippingCents = isFree ? 0 : feeCents;

  return {
    subtotalCents: subtotal,
    shippingCents,
    totalCents: subtotal + shippingCents,
    isFree,
    amountToFreeCents: isFree ? 0 : thresholdCents - subtotal,
    thresholdCents,
    feeCents,
    methodName: isFree ? `Free ${settings.methodName.toLowerCase()}` : settings.methodName,
  };
};

module.exports = {
  DEFAULT_SHIPPING,
  toCents,
  normalizeShippingSettings,
  calculateShipping,
};
