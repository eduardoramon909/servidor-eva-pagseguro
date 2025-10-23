const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Função auxiliar para validar o tipo de plano
const getPlanDetails = (planType) => {
  switch (planType) {
    case 'monthly':
      return { amount: 1999, description: 'Eva Premium Mensal' }; // R$ 19,99
    case 'annual':
      return { amount: 11999, description: 'Eva Premium Anual' }; // R$ 119,99
    default:
      throw new Error('Tipo de plano inválido.'); // Lança erro se o plano não for reconhecido
  }
};

module.exports = async (request, response) => {
  if (request.method !== 'POST') {
    return response.status(405).send('Método não permitido');
  }

  try {
    // 1. Extrai o tipo de plano do corpo da requisição
    const { planType } = request.body;
    if (!planType) {
       return response.status(400).json({ error: 'Tipo de plano (planType) é obrigatório.' });
    }

    // 2. Obtém os detalhes do plano (valor e descrição)
    const { amount, description } = getPlanDetails(planType);

    // Cria a Intenção de Pagamento com o valor correto
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: 'brl',
      payment_method_types: ['card', 'boleto'],
      receipt_email: 'cliente.pagamento@email.com', // Usar email real do cliente no futuro
      shipping: { // Dados de exemplo, usar dados reais no futuro
        name: 'Cliente Eva Premium',
        address: {
          line1: 'Endereço Exemplo, 123',
          city: 'Cidade Exemplo',
          state: 'SP',
          postal_code: '01000-000',
          country: 'BR',
        },
      },
      // 3. Adiciona metadata para identificar o plano e talvez o usuário
      metadata: {
        order_id: `eva_premium_${planType}_${Date.now()}`,
        plan: planType,
        // user_id: 'ID_DO_USUARIO_LOGADO' // Adicionar no futuro
      },
      description: description // Descrição que pode aparecer na fatura
    });

    let boletoUrl = null;
    if (paymentIntent.next_action && paymentIntent.next_action.boleto_display_details) {
      boletoUrl = paymentIntent.next_action.boleto_display_details.hosted_voucher_url;
    }

    response.status(200).json({
      clientSecret: paymentIntent.client_secret,
      boletoUrl: boletoUrl,
    });

  } catch (error) {
    console.error("ERRO STRIPE (Intent/Planos):", error.message);
    // Retorna a mensagem de erro específica (ex: 'Tipo de plano inválido.')
    response.status(400).json({ error: `Stripe Error: ${error.message}` });
  }
};