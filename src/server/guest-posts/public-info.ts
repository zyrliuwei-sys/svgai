import { listGuestPostPackages } from '@/config/pricing';
import { getAllConfigs } from '@/modules/config/service';

import { guestPostSettings } from './settings';

export async function getGuestPostPublicInfo() {
  const settings = guestPostSettings(await getAllConfigs());
  return {
    enabled: settings.enabled,
    minWords: settings.minWords,
    packages: listGuestPostPackages().map((p) => ({
      productId: p.productId,
      planName: p.planName,
      description: p.description,
      priceInCents: p.priceInCents,
      currency: p.currency,
      cnyPriceInCents: p.cnyPriceInCents ?? null,
      maxLinks: p.maxLinks ?? 0,
    })),
  };
}
