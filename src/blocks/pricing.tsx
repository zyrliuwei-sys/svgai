import { useEffect, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useSession } from '@/core/auth/client';
import { useRouter } from '@/core/i18n/navigation';
import { SVG_RESERVED_CREDITS } from '@/config/generation';
import { pricingCatalog } from '@/config/pricing';
import { apiPost } from '@/lib/api-client';
import { track } from '@/lib/track';
import { m } from '@/paraglide/messages.js';
import { usePublicConfig } from '@/hooks/use-public-config';
import {
  PaymentProviderModal,
  type PaymentProvider,
} from '@/components/payment-provider-modal';
import { SvgPricing, type SvgPricingGroup } from '@/components/svg-pricing';

import '@/styles/svg-pricing.css';

const ALL_PROVIDERS: PaymentProvider[] = ['stripe', 'creem', 'paypal'];
export function Pricing({ headingLevel = 1 }: { headingLevel?: 1 | 2 } = {}) {
  const router = useRouter();
  const [initialGroup, setInitialGroup] = useState('once');
  useEffect(() => {
    const selected = new URLSearchParams(window.location.search).get('plan');
    if (
      selected &&
      pricingCatalog[selected] &&
      pricingCatalog[selected].kind !== 'guest_post'
    )
      setInitialGroup(pricingCatalog[selected].plan ? 'monthly' : 'once');
  }, []);
  const { data: session } = useSession();
  const { data: configs = {} } = usePublicConfig();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [loadingProvider, setLoadingProvider] =
    useState<PaymentProvider | null>(null);
  const enabledProviders = useMemo(
    () => ALL_PROVIDERS.filter((p) => configs[`${p}_enabled`] === 'true'),
    [configs]
  );
  const checkout = useMutation({
    mutationFn: ({ id, provider }: { id: string; provider: PaymentProvider }) =>
      apiPost<{ checkout_url?: string }>('/api/payment/checkout', {
        product_id: id,
        payment_provider: provider,
        redirect: new URLSearchParams(window.location.search).has('preview')
          ? '/?resumePreview=1#generator'
          : '/settings/payments',
      }),
    onSuccess: (data) => {
      if (data.checkout_url) window.location.assign(data.checkout_url);
      else toast.error(m['svgai.pricing.checkout_error']());
    },
    onError: (error: Error) => toast.error(error.message),
    onSettled: () => {
      setLoadingProvider(null);
      setPendingId(null);
    },
  });
  const groups: SvgPricingGroup[] = (['once', 'monthly'] as const).map(
    (group) => ({
      id: group,
      label:
        group === 'once'
          ? m['svgai.pricing.once']()
          : m['svgai.pricing.monthly'](),
      note:
        group === 'once'
          ? m['svgai.pricing.once_note']()
          : m['svgai.pricing.monthly_note'](),
      interval:
        group === 'once'
          ? m['svgai.pricing.one_time']()
          : m['svgai.pricing.per_month'](),
      cta:
        group === 'once'
          ? m['svgai.pricing.buy_credits']()
          : m['svgai.pricing.subscribe'](),
      plans: (['starter', 'pro', 'studio'] as const).map((tier) => {
        const product = pricingCatalog[`${tier}_${group}`];
        return {
          id: product.productId,
          name:
            tier === 'starter'
              ? m['svgai.pricing.starter']()
              : tier === 'pro'
                ? m['svgai.pricing.pro']()
                : m['svgai.pricing.studio'](),
          description:
            tier === 'starter'
              ? m['svgai.pricing.starter_desc']()
              : tier === 'pro'
                ? m['svgai.pricing.pro_desc']()
                : m['svgai.pricing.studio_desc'](),
          price: new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: product.currency,
            maximumFractionDigits: 0,
          }).format(product.priceInCents / 100),
          credits: product.credits.toLocaleString('en-US'),
          estimate: m['svgai.pricing.estimate']({
            count: Math.floor(product.credits / SVG_RESERVED_CREDITS),
          }),
          ...(group === 'monthly'
            ? {
                comparison: new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: product.currency,
                  maximumFractionDigits: 0,
                }).format(pricingCatalog[`${tier}_once`].priceInCents / 100),
                savings: m['svgai.pricing.savings']({
                  percent: Math.round(
                    (1 -
                      product.priceInCents /
                        pricingCatalog[`${tier}_once`].priceInCents) *
                      100
                  ),
                }),
              }
            : {}),
          featured: tier === 'pro',
        };
      }),
    })
  );
  function start(id: string, provider: PaymentProvider) {
    setPendingId(id);
    setLoadingProvider(provider);
    checkout.mutate({ id, provider });
  }
  function handleCheckout(id: string) {
    track('plan_selected', {
      product: id,
      interval: pricingCatalog[id].plan?.interval || 'once',
    });
    if (!session?.user) {
      const preview = new URLSearchParams(window.location.search).get(
        'preview'
      );
      router.push(
        `/sign-in?callbackUrl=${encodeURIComponent(`/pricing?plan=${id}${preview ? '&preview=' + encodeURIComponent(preview) : ''}#pricing`)}`
      );
      return;
    }
    if (!enabledProviders.length) {
      toast.error(m['svgai.pricing.payment_unavailable']());
      return;
    }
    if (
      configs.select_payment_enabled === 'true' &&
      enabledProviders.length > 1
    ) {
      setPendingId(id);
      setModalOpen(true);
      return;
    }
    const configured = configs.default_payment_provider as PaymentProvider;
    start(
      id,
      enabledProviders.includes(configured) ? configured : enabledProviders[0]
    );
  }
  return (
    <>
      <SvgPricing
        headingLevel={headingLevel}
        initialGroup={initialGroup}
        groups={groups}
        onCheckout={handleCheckout}
        loadingId={checkout.isPending ? pendingId : null}
        copy={{
          eyebrow: m['svgai.pricing.eyebrow'](),
          title: m['svgai.pricing.title'](),
          description: m['svgai.pricing.description'](),
          popular: m['svgai.pricing.popular'](),
          credits: m['svgai.pricing.credits'](),
          processing: m['common.pricing.processing'](),
          perCredit: m['svgai.pricing.per_credit'](),
          billingNote: m['svgai.pricing.billing_note'](),
          billingTitle: m['svgai.pricing.billing_title'](),
          billingDescription: m['svgai.pricing.billing_description'](),
          reserve: m['svgai.pricing.reserve']({
            credits: SVG_RESERVED_CREDITS,
          }),
          refund: m['svgai.pricing.refund'](),
          features: [
            m['svgai.pricing.feature_generation'](),
            m['svgai.pricing.feature_export'](),
            m['svgai.pricing.feature_edit'](),
            m['svgai.pricing.feature_image'](),
          ],
          faqTitle: m['svgai.pricing.faq_title'](),
          faqs: [
            {
              question: m['svgai.pricing.faq_cost_q'](),
              answer: m['svgai.pricing.faq_cost_a'](),
            },
            {
              question: m['svgai.pricing.faq_expiry_q'](),
              answer: m['svgai.pricing.faq_expiry_a'](),
            },
            {
              question: m['svgai.pricing.faq_cancel_q'](),
              answer: m['svgai.pricing.faq_cancel_a'](),
            },
            {
              question: m['svgai.pricing.faq_fail_q'](),
              answer: m['svgai.pricing.faq_fail_a'](),
            },
          ],
        }}
      />
      <PaymentProviderModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        providers={enabledProviders}
        loadingProvider={loadingProvider}
        onSelect={(provider) => {
          if (pendingId) start(pendingId, provider);
        }}
        planName={pendingId ? pricingCatalog[pendingId].planName : undefined}
      />
    </>
  );
}
