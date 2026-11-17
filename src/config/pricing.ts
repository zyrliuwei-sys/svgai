/**
 * Authoritative pricing catalog.
 *
 * The checkout API uses this as the SOURCE OF TRUTH for price/credits/duration.
 * Any price, credits, or plan info sent by the client is IGNORED — only the
 * product_id is honored, and everything else is looked up here.
 *
 * To change pricing, edit this file and redeploy. Admin UI cannot alter prices.
 */

import { PaymentInterval, PaymentType } from '@/core/payment/types';

export type PricingPlanInfo = {
  name: string;
  interval: PaymentInterval;
  intervalCount: number;
};

export type PricingProduct = {
  productId: string;
  productName: string;
  planName: string;
  description: string;
  type: PaymentType;
  priceInCents: number;
  currency: string;
  /**
   * Price in fen for CNY-only providers (Alipay, WeChat Pay) when `currency`
   * isn't CNY. Without it those providers refuse the product — the amount is
   * never reused across currencies.
   */
  cnyPriceInCents?: number;
  credits: number;
  creditsValidDays?: number;
  plan?: PricingPlanInfo;
  /**
   * 'guest_post': a guest post package. Sold only through
   * /api/guest-posts/$id/checkout (tied to an approved submission); the
   * generic checkout refuses it.
   */
  kind?: 'guest_post';
  /** Guest post packages: most external links the article may contain. */
  maxLinks?: number;
};

/** Six SVG credit products. The generation debit is
 * ceil(actual SeeAPI credits × 8), with no tier-specific credit discounts.
 * Credit packs use the conservative SeeAPI Creator Pack basis ($299 / 55,000
 * provider credits); one-time packs retain the 8x cost factor. Monthly plans discount the same
 * credits by approximately 22–25%, retaining a 6x cost floor on that basis.
 * Monthly credits expire at the paid billing period end. One-time credits do not expire.
 */
export const pricingCatalog: Record<string, PricingProduct> = {
  starter_once: {
    productId: 'starter_once',
    productName: 'Starter credits',
    planName: 'Starter',
    description: 'Starter one-time credit pack',
    type: PaymentType.ONE_TIME,
    priceInCents: 900,
    currency: 'usd',
    credits: 1600,
  },
  pro_once: {
    productId: 'pro_once',
    productName: 'Pro credits',
    planName: 'Pro',
    description: 'Pro one-time credit pack',
    type: PaymentType.ONE_TIME,
    priceInCents: 2900,
    currency: 'usd',
    credits: 5200,
  },
  studio_once: {
    productId: 'studio_once',
    productName: 'Studio credits',
    planName: 'Studio',
    description: 'Studio one-time credit pack',
    type: PaymentType.ONE_TIME,
    priceInCents: 7900,
    currency: 'usd',
    credits: 14400,
  },
  starter_monthly: {
    productId: 'starter_monthly',
    productName: 'Starter',
    planName: 'Starter',
    description: 'Starter monthly credits',
    type: PaymentType.SUBSCRIPTION,
    priceInCents: 700,
    currency: 'usd',
    credits: 1600,
    creditsValidDays: 31,
    plan: {
      name: 'Starter',
      interval: PaymentInterval.MONTH,
      intervalCount: 1,
    },
  },
  pro_monthly: {
    productId: 'pro_monthly',
    productName: 'Pro',
    planName: 'Pro',
    description: 'Pro monthly credits',
    type: PaymentType.SUBSCRIPTION,
    priceInCents: 2200,
    currency: 'usd',
    credits: 5200,
    creditsValidDays: 31,
    plan: { name: 'Pro', interval: PaymentInterval.MONTH, intervalCount: 1 },
  },
  studio_monthly: {
    productId: 'studio_monthly',
    productName: 'Studio',
    planName: 'Studio',
    description: 'Studio monthly credits',
    type: PaymentType.SUBSCRIPTION,
    priceInCents: 5900,
    currency: 'usd',
    credits: 14400,
    creditsValidDays: 31,
    plan: { name: 'Studio', interval: PaymentInterval.MONTH, intervalCount: 1 },
  },

  // Guest posts (see src/modules/guest-posts). Published permanently, every
  // external link rendered rel="sponsored nofollow".
  guest_post_standard: {
    productId: 'guest_post_standard',
    productName: 'Guest Post',
    planName: 'Standard',
    description: 'Guest post (1 link)',
    type: PaymentType.ONE_TIME,
    priceInCents: 9900,
    currency: 'usd',
    cnyPriceInCents: 69900,
    credits: 0,
    kind: 'guest_post',
    maxLinks: 1,
  },
  guest_post_premium: {
    productId: 'guest_post_premium',
    productName: 'Guest Post',
    planName: 'Premium',
    description: 'Guest post (3 links)',
    type: PaymentType.ONE_TIME,
    priceInCents: 19900,
    currency: 'usd',
    cnyPriceInCents: 139900,
    credits: 0,
    kind: 'guest_post',
    maxLinks: 3,
  },
};

export function getPricingProduct(productId: string): PricingProduct | null {
  if (!productId) return null;
  return pricingCatalog[productId] ?? null;
}

export function listPricingProducts(): PricingProduct[] {
  return Object.values(pricingCatalog);
}

export function listGuestPostPackages(): PricingProduct[] {
  return listPricingProducts().filter((p) => p.kind === 'guest_post');
}
