const fetch = require('node-fetch');
const crypto = require('crypto');

function allowCors(fn) {
    return async (req, res) => {
        res.setHeader('Access-Control-Allow-Credentials', true);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
        res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
        if (req.method === 'OPTIONS') return res.status(200).end();
        return await fn(req, res);
    };
}

async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Metode HTTP tidak diizinkan. Gunakan POST.' });
    }

    try {
        const { packageName, price, name, telegram, whatsapp } = req.body;
        if (!packageName || !price || !name || !telegram || !whatsapp) {
            return res.status(400).json({ success: false, message: 'Payload data formulir tidak lengkap.' });
        }

        const va = process.env.IPAYMU_VA ? process.env.IPAYMU_VA.trim() : '';
        const apiKey = process.env.IPAYMU_KEY ? process.env.IPAYMU_KEY.trim() : '';
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        const chatId = process.env.TELEGRAM_CHAT_ID;
        const backendDomain = process.env.BACKEND_DOMAIN;
        const isProduction = process.env.IPAYMU_SANDBOX !== 'true';

        const orderId = 'AJM-' + Date.now();
        const formatHarga = parseInt(price).toLocaleString('id-ID');

        const body = {
            product: [packageName],
            qty: [1],
            price: [parseInt(price)],
            description: [`Pembelian lisensi ${packageName}`],
            returnUrl: 'https://t.me/Rayanxweb37',
            cancelUrl: 'https://t.me/Rayanxweb37',
            notifyUrl: `${backendDomain}/api/callback`,
            referenceId: orderId,
            buyerName: name,
            buyerPhone: whatsapp,
            buyerEmail: 'buyer@rayanxweb.store',
            weight: [0],
            height: [0],
            length: [0],
            width: [0]
        };

        const bodyEncrypt = JSON.stringify(body);
        const requestBodyHash = crypto.createHash('sha256').update(bodyEncrypt).digest('hex').toLowerCase();
        const stringToSign = `POST:${va}:${requestBodyHash}:${apiKey}`;
        const signature = crypto.createHmac('sha256', apiKey).update(stringToSign).digest('hex');

        const url = isProduction 
            ? 'https://my.ipaymu.com/api/v2/payment' 
            : 'https://sandbox.ipaymu.com/api/v2/payment';

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'va': va,
                'signature': signature
            },
            body: bodyEncrypt
        });

        const result = await response.json();
        if (result.Status !== 200) {
            throw new Error(result.Message || 'Gagal melakukan handshake ke API Gateway iPaymu.');
        }

        const paymentUrl = result.Data.Url;

        const pesanTelegram = 
`📝 *INVOICE BARU DIBUAT* 📝
-----------------------------------------
📌 *ID Order:* ${orderId}
📦 *Paket:* ${packageName}
💰 *Total:* Rp ${formatHarga}
👤 *Nama:* ${name}
✈️ *Telegram:* ${telegram}
📱 *WhatsApp:* ${whatsapp}
-----------------------------------------
🔗 *Link Pembayaran:* ${paymentUrl}
⏳ _Status: Menunggu proses pembayaran oleh user..._`;

        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: pesanTelegram, parse_mode: 'Markdown' })
        });

        return res.status(200).json({ success: true, paymentUrl });

    } catch (error) {
        console.error('Payment Processing Error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
}

module.exports = allowCors(handler);
