const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
// ADICIONADO: Importação do Firebase Admin
const admin = require('firebase-admin');

// --- INÍCIO: Lógica de inicialização do Firebase Admin ---
try {
  // Puxa as credenciais da variável de ambiente que criamos no Vercel
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);

  // Inicializa o app do Firebase, mas SOMENTE se ainda não foi inicializado
  // Isso previne erros em "warm" functions da Vercel
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  }
} catch (e) {
  console.error('ERRO AO INICIALIZAR FIREBASE ADMIN:', e.message);
}

// Obtém a instância do Firestore
const db = admin.firestore();
// --- FIM: Lógica de inicialização do Firebase Admin ---


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
    console.log('✅ PAGAMENTO BEM-SUCEDIDO (STRIPE)!');
    console.log('ID do Pagamento:', paymentIntent.id);

    // --- INÍCIO: Lógica de atualização do Firestore ---
    try {
      // 1. Extrai os metadados que enviamos do Flutter
      const userId = paymentIntent.metadata.user_id;
      const planType = paymentIntent.metadata.plan; // 'monthly' ou 'annual'

      // 2. Validação (impede de continuar se não tiver o ID do usuário)
      if (!userId || userId === 'no_user_id') {
        throw new Error(`UserID não encontrado nos metadados do PaymentIntent: ${paymentIntent.id}`);
      }
      if (!planType) {
         throw new Error(`PlanType não encontrado nos metadados do PaymentIntent: ${paymentIntent.id}`);
      }

      console.log(`Atualizando status Premium para Usuário: ${userId}, Plano: ${planType}`);

      // 3. Calcula a data de expiração
      const expiryDate = new Date();
      if (planType === 'monthly') {
        expiryDate.setDate(expiryDate.getDate() + 30); // 30 dias
      } else if (planType === 'annual') {
        expiryDate.setDate(expiryDate.getDate() + 365); // 365 dias
      }
      
      // Converte para o formato Timestamp do Firestore
      const premiumExpiryTimestamp = admin.firestore.Timestamp.fromDate(expiryDate);

      // 4. Obtém a referência do documento do usuário no Firestore
      // (Conforme sua sugestão: coleção "usuarios", documento com ID do usuário)
      const userRef = db.collection('usuarios').doc(userId);

      // 5. Atualiza o documento
      await userRef.set({
        isPremium: true,
        premiumExpiryDate: premiumExpiryTimestamp,
        planType: planType,
        lastPaymentId: paymentIntent.id, // Bônus: salva o ID da última transação
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true }); // { merge: true } é crucial! Ele atualiza ou cria sem apagar outros campos.

      console.log(`✅ Firestore atualizado com sucesso para o usuário ${userId}.`);

    } catch (dbError) {
      console.error('❌ ERRO AO ATUALIZAR FIRESTORE:', dbError.message);
      // Mesmo se o DB falhar, respondemos 200 ao Stripe para evitar retentativas.
      // (Em um sistema mais complexo, você poderia responder 500 para o Stripe tentar de novo)
    }
    // --- FIM: Lógica de atualização do Firestore ---
  }

  // Responde ao Stripe que recebemos o evento
  response.status(200).json({ received: true });
};