const { connectLambda, getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  connectLambda(event);

  const email = event.queryStringParameters && event.queryStringParameters.email;
  if (!email) {
    return { statusCode: 400, body: JSON.stringify({ error: 'email required' }) };
  }

  const store = getStore('dishmatrix-users');
  const record = await store.get(email, { type: 'json' });
  return { statusCode: 200, body: JSON.stringify({ plan: (record && record.plan) || 'starter' }) };
};
