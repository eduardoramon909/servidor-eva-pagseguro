// Importa a biblioteca oficial do Stripe
// Ele vai procurar a chave automaticamente nas variáveis de ambiente
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async (request, response) => {
  // Apenas aceita requisições POST
  if (request.method !== 'POST') {
    return response.status(405).send('Método não permitido');
  }

  try {
    // Valor em centavos (R$ 14,90 = 1490 centavos)
    const amount = 1490;

    // Cria a "Intenção de Pagamento" no Stripe
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: 'brl',
      // Informa ao Stripe quais métodos de pagamento esperamos
      // Adicionei 'boleto' que você mencionou ter visto
      payment_method_types: ['card', 'pix', 'boleto'],
    });

    // Envia a "chave secreta" do cliente de volta para o app Flutter
    // O app usará isso para mostrar o formulário de pagamento correto
    response.status(200).json({
      clientSecret: paymentIntent.client_secret,
    });

  } catch (error) {
    console.error("ERRO AO CRIAR INTENT NO STRIPE:", error.message);
    response.status(500).json({ error: `Erro do Stripe: ${error.message}` });
  }
};