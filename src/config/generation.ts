/** SeeAPI /v1/prices verified 2026-11-17: 20-credit precharge, actual usage settlement. */
export const SVG_MODEL = 'gpt-image-2-6-sunburst';
export const SVG_CREDIT_MULTIPLIER = 8;
export const SVG_PROVIDER_PRECHARGE = 20;
export const SVG_RESERVED_CREDITS =
  SVG_PROVIDER_PRECHARGE * SVG_CREDIT_MULTIPLIER;
export const SVG_IMAGE_CREDITS = 160;

/** Provider precision is 0.001 credits. Work in thousandths to avoid float overcharges. */
export function generationCredits(providerCredits: number): number {
  if (
    !Number.isFinite(providerCredits) ||
    providerCredits < 0 ||
    providerCredits > 1_000_000
  )
    throw new Error('Invalid provider usage');
  const thousandths = Math.round(providerCredits * 1000);
  if (Math.abs(thousandths / 1000 - providerCredits) > 0.000001)
    throw new Error('Invalid provider usage precision');
  return Math.ceil((thousandths * SVG_CREDIT_MULTIPLIER) / 1000);
}
