import { envConfigs } from '@/config';

/** Public identity shared by canonical URLs, the sitemap and social cards. */
export const SITE_URL = new URL(envConfigs.app_url).origin;
export const SITE_IMAGE = `${SITE_URL}/brand/social-card.png`;
export const PRODUCT_PATHS = [
  '/',
  '/text-to-svg',
  '/image-to-svg',
  '/examples',
  '/how-it-works',
] as const;
