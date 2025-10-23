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
    // 1. Extrai o tipo de plano e email do corpo da requisição
    const { planType, email, userId } = request.body;
    
    if (!planType) {
       return response.status(400).json({ error: 'Tipo de plano (planType) é obrigatório.' });
    }

    // 2. Obtém os detalhes do plano (valor e descrição)
    const { amount, description } = getPlanDetails(planType);

    // 3. IMPORTANTE: Criar ou buscar o Customer do Stripe
    let customer;
    const customerEmail = email || 'cliente.pagamento@email.com';
    
    // Busca se já existe um customer com esse email
    const existingCustomers = await stripe.customers.list({
      email: customerEmail,
      limit: 1
    });

    if (existingCustomers.data.length > 0) {
      customer = existingCustomers.data[0];
    } else {
      // Cria novo customer
      customer = await stripe.customers.create({
        email: customerEmail,
        metadata: {
          user_id: userId || 'no_user_id',
          app: 'eva_premium'
        }
      });
    }

    // 4. Criar Ephemeral Key para o customer (necessário para Payment Sheet)
    const ephemeralKey = await stripe.ephemeralKeys.create(
      { customer: customer.id },
      { apiVersion: '2024-11-20.acacia' } // Use a versão mais recente da API do Stripe
    );

    // 5. Cria a Intenção de Pagamento com o valor correto
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: 'brl',
      customer: customer.id, // Associa ao customer
      payment_method_types: ['card', 'boleto'],
      receipt_email: customerEmail,
      
      // Configurações específicas para cada método de pagamento
      payment_method_options: {
        boleto: {
          expires_after_days: 3 // Boleto expira em 3 dias
        },
        card: {
          request_three_d_secure: 'automatic' // 3D Secure quando necessário
        }
      },
      
      shipping: { 
        name: 'Cliente Eva Premium',
        address: {
          line1: 'Endereço Exemplo, 123',
          city: 'Cidade Exemplo',
          state: 'SP',
          postal_code: '01000-000',
          country: 'BR',
        },
      },
      
      // Metadata para rastreamento
      metadata: {
        order_id: `eva_premium_${planType}_${Date.now()}`,
        plan: planType,
        user_id: userId || 'no_user_id'
      },
      
      description: description,
      
      // IMPORTANTE: Permite métodos de pagamento com delay (como boleto)
      capture_method: 'automatic_async'
    });

    // 6. Prepara resposta com todas as informações necessárias
    const responseData = {
      paymentIntent: paymentIntent.client_secret,
      ephemeralKey: ephemeralKey.secret,
      customer: customer.id
    };

    // 7. Se já houver informações de boleto, inclui na resposta
    if (paymentIntent.next_action && paymentIntent.next_action.boleto_display_details) {
      responseData.boletoUrl = paymentIntent.next_action.boleto_display_details.hosted_voucher_url;
    }

    console.log('✅ Payment Intent criado com sucesso:', paymentIntent.id);
    response.status(200).json(responseData);

  } catch (error) {
    console.error("❌ ERRO STRIPE (Intent/Planos):", error.message);
    console.error("Stack:", error.stack);
    
    // Retorna a mensagem de erro específica
    response.status(400).json({ 
      error: `Stripe Error: ${error.message}`,
      type: error.type || 'api_error'
    });
  }
};