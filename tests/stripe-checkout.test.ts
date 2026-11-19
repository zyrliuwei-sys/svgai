import assert from 'node:assert/strict';
import { test } from 'node:test';

import { pricingCatalog } from '../src/config/pricing';
import { StripeProvider } from '../src/core/payment/stripe';
import { PaymentType } from '../src/core/payment/types';

test('all catalog checkouts opt out of Managed Payments, including concurrent credit-pack, subscription and guest-post purchases', async (t) => {
  const requests: URLSearchParams[] = [];
  t.mock.method(
    globalThis,
    'fetch',
    async (input: string, init: RequestInit) => {
      assert.equal(new URL(input).pathname, '/v1/checkout/sessions');
      assert.equal(init.method, 'POST');
      const body = new URLSearchParams(String(init.body));
      requests.push(body);
      // Reproduce an account with Managed Payments enabled by default: the
      // request must override it before Stripe will accept tax-code-free items.
      assert.equal(body.get('managed_payments[enabled]'), 'false');
      return Response.json({
        id: `checkout-fixture-${requests.length}`,
        url: 'https://checkout.example/fixture',
      });
    }
  );
  const provider = new StripeProvider({
    secretKey: 'unit-test-placeholder',
    publishableKey: '',
  });
  const products = Object.values(pricingCatalog);
  const results = await Promise.all(
    products.map((product) =>
      provider.createPayment({
        order: {
          type: product.type,
          price: { amount: product.priceInCents, currency: product.currency },
          description: product.productName,
          plan: product.plan,
          metadata: { product_id: product.productId },
          successUrl: 'https://product.example/settings/payments',
          cancelUrl: 'https://product.example/pricing',
        },
      })
    )
  );
  assert.equal(requests.length, products.length);
  assert.equal(results.length, products.length);
  assert.ok(products.some((product) => product.kind === 'guest_post'));
  assert.ok(
    products.some((product) => product.type === PaymentType.SUBSCRIPTION)
  );
  for (const [index, product] of products.entries()) {
    const body = requests.find(
      (request) => request.get('metadata[product_id]') === product.productId
    )!;
    assert.ok(body);
    assert.equal(
      body.get('mode'),
      product.type === PaymentType.SUBSCRIPTION ? 'subscription' : 'payment'
    );
    assert.equal(
      body.get('line_items[0][price_data][unit_amount]'),
      String(product.priceInCents)
    );
    assert.equal(
      body.get('line_items[0][price_data][currency]'),
      product.currency
    );
    assert.deepEqual(
      (results[index].checkoutParams as { managed_payments: unknown })
        .managed_payments,
      { enabled: false }
    );
  }
});
