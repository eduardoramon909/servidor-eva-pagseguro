const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async (request, response) => {
  if (request.method !== 'POST') {
    return response.status(405).send('Método não permitido');
  }

  try {
    // Valor (ainda R$ 0,50 para teste)
    const amount = 50;

    // Cria a Intenção de Pagamento incluindo 'boleto'
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: 'brl',
      payment_method_types: ['card', 'boleto'], // Garante que boleto está incluído
      // Dados do cliente para o Boleto (pode vir do app no futuro)
      // O Stripe exige pelo menos o email e nome para boletos via API
      // Adicionamos CPF/CNPJ e endereço para maior compatibilidade
       receipt_email: 'cliente.boleto@email.com', // Email para recibo (opcional)
       shipping: { // Stripe pode usar shipping como billing para boleto
           name: 'Cliente Eva Boleto',
           address: {
             line1: 'Av. Paulista, 1000',
             // line2: null, // Stripe não exige line2 para boleto via API
             city: 'Sao Paulo',
             state: 'SP',
             postal_code: '01310-100',
             country: 'BR',
           },
       },
       // Metadata opcional
       metadata: {
           order_id: `eva_premium_${Date.now()}`
       }
    });

    // Variável para guardar a URL do boleto
    let boletoUrl = null;

    // IMPORTANTE: Após criar o PaymentIntent, precisamos buscar
    // a URL do boleto. Isso geralmente está na propriedade 'next_action'.
    if (paymentIntent.next_action && paymentIntent.next_action.boleto_display_details) {
      boletoUrl = paymentIntent.next_action.boleto_display_details.hosted_voucher_url;
    }

    // Retorna o clientSecret (para cartão) E a URL do boleto (se gerada)
    response.status(200).json({
      clientSecret: paymentIntent.client_secret,
      boletoUrl: boletoUrl, // Envia a URL para o app
    });

  } catch (error) {
    console.error("ERRO STRIPE (Intent/Boleto):", error.message);
    response.status(500).json({ error: `Stripe Error: ${error.message}` });
  }
};