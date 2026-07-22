const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { connectLambda, getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  connectLambda(event);

  const sig = event.headers['stripe-signature'];
  const payload = event.isBase64Encoded ? Buffer.from(event.body, 'base64') : event.body;

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(payload, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  const store = getStore('dishmatrix-users');

  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object;
    const email = session.customer_details?.email || session.customer_email || session.metadata?.email;
    const plan = session.metadata?.plan;
    if (email && plan) {
      await store.setJSON(email, {
        plan,
        stripeCustomerId: session.customer,
        updatedAt: new Date().toISOString()
      });
      await store.set(`customer:${session.customer}`, email);
      console.log(`[stripe] ${email} paid for ${plan}`);
    }
  }

  if (stripeEvent.type === 'customer.subscription.deleted') {
    const subscription = stripeEvent.data.object;
    const email = await store.get(`customer:${subscription.customer}`, { type: 'text' });
    if (email) {
      const existing = await store.get(email, { type: 'json' });
      await store.setJSON(email, {
        ...(existing || {}),
        plan: 'starter',
        updatedAt: new Date().toISOString()
      });
      console.log(`[stripe] ${email} downgraded to starter (subscription cancelled)`);
    }
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
