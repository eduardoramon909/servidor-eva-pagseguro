// Importa a biblioteca oficial do Stripe
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async (request, response) => {
  if (request.method !== 'POST') {
    return response.status(405).send('Método não permitido');
  }

  try {
    // VALOR ALTERADO PARA 50 CENTAVOS (R$ 0,50)
    const amount = 50; 

    // Cria a "Intenção de Pagamento" no Stripe
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: 'brl',
      // Informa ao Stripe quais métodos de pagamento esperamos
      payment_method_types: ['card', 'pix', 'boleto'], // Mesmo que Pix e Boleto não estejam ativos ainda
    });

    // Envia a "chave secreta" do cliente de volta para o app Flutter
    response.status(200).json({
      clientSecret: paymentIntent.client_secret,
    });

  } catch (error) {
    console.error("ERRO STRIPE:", error.message);
    response.status(500).json({ error: error.message });
  }
};