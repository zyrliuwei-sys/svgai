import { brandName } from '@/config/brand';
import { m } from '@/paraglide/messages.js';

// Dynamic message lookup for keys built at runtime (tab labels, keyed
// lists). Prefer static `m["ns.key"]()` whenever the key is known —
// dynamic access opts the whole message bundle out of tree-shaking.
export function tDynamic(key: string): string {
  const fn = (m as Record<string, unknown>)[key];
  return typeof fn === 'function'
    ? (fn as (inputs: { brand: string }) => string)({ brand: brandName })
    : key;
}
