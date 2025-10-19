const axios = require('axios');

// A Vercel transforma este arquivo em um endpoint de API automaticamente.
module.exports = async (request, response) => {
  // Pega o token seguro das "Environment Variables" que configuramos na Vercel.
  const PAGSEGURO_TOKEN = process.env.PAGSEGURO_TOKEN;

  if (!PAGSEGURO_TOKEN) {
    return response.status(500).json({ error: "Token do PagSeguro não foi configurado no servidor." });
  }

  try {
    const apiResponse = await axios.post(
      'https://sandbox.api.pagseguro.com/orders', // URL de testes (Sandbox) - CORRIGIDO
      {
        "reference_id": `eva_premium_${new Date().getTime()}`,
        "customer": { "name": "Cliente Eva Premium", "email": "cliente@email.com", "tax_id": "12345678900" },
        "items": [ { "name": "Eva Premium (Mensal)", "quantity": 1, "unit_amount": 1490 } ],
        "qr_codes": [ { "amount": { "value": 1490 }, "expiration_date": new Date(Date.now() + 3600 * 1000).toISOString() } ],
        "notification_urls": ["https://webhook.site/"] // Um webhook temporário para testes - CORRIGIDO
      },
      {
        headers: {
          'Authorization': `Bearer ${PAGSEGURO_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const qrCodeData = {
      qrCodeText: apiResponse.data.qr_codes[0].text,
      orderId: apiResponse.data.id
    };
    
    // Envia a resposta de sucesso para o app Flutter
    return response.status(200).json(qrCodeData);

  } catch (error) {
    console.error("ERRO PAGSEGURO:", error.response ? error.response.data : error.message);
    return response.status(500).json({ error: 'Falha ao comunicar com o PagSeguro.' });
  }
};