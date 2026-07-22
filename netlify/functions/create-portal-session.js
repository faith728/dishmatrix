const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { connectLambda, getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  connectLambda(event);

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  let email;
  try {
    email = JSON.parse(event.body || '{}').email;
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body.' }) };
  }
  if (!email) return { statusCode: 400, body: JSON.stringify({ error: 'email required' }) };

  const store = getStore('dishmatrix-users');
  const record = await store.get(email, { type: 'json' });
  if (!record || !record.stripeCustomerId) {
    return { statusCode: 404, body: JSON.stringify({ error: 'No subscription found for that email.' }) };
  }

  const domain = process.env.URL || process.env.DEPLOY_PRIME_URL || 'http://localhost:8888';

  try {
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: record.stripeCustomerId,
      return_url: `${domain}/dishmatrix.html`
    });
    return { statusCode: 200, body: JSON.stringify({ url: portalSession.url }) };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Could not open billing portal.' }) };
  }
};
