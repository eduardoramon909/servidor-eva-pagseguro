const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Função para ler o corpo da requisição (necessário para o Stripe)
async function buffer(readable) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

// Desativa o parser de corpo padrão da Vercel
export const config = {
  api: {
    bodyParser: false,
  },
};

module.exports = async (request, response) => {
  if (request.method !== 'POST') {
    return response.status(405).send('Método não permitido');
  }

  const buf = await buffer(request);
  const sig = request.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    // Verifica se a requisição veio mesmo do Stripe
    event = stripe.webhooks.constructEvent(buf, sig, endpointSecret);
  } catch (err) {
    console.error(`Webhook Error: ${err.message}`);
    return response.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Lida com o evento de pagamento bem-sucedido
  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object;
    console.log('---------------------------------');
    console.log('PAGAMENTO BEM-SUCEDIDO (STRIPE)!');
    console.log('ID do Pagamento:', paymentIntent.id);
    console.log('Valor:', paymentIntent.amount);
    // TODO: Aqui você atualizaria seu banco de dados
    // para dar ao usuário o status de "Premium".
    console.log('---------------------------------');
  }

  // Responde ao Stripe que recebemos o evento
  response.status(200).json({ received: true });
};