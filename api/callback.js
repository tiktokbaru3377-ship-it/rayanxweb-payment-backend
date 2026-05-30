const fetch = require('node-fetch');

async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Metode ini eksklusif untuk webhook POST iPaymu.' });
    }

    try {
        const { reference_id, status, trx_id, sid, price } = req.body;
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        const chatId = process.env.TELEGRAM_CHAT_ID;

        if (status === 'berhasil' || req.body.status === 'berhasil') {
            const formatHarga = price ? parseInt(price).toLocaleString('id-ID') : '-';
            
            const pesanSuksesTelegram = 
`✅ *TRANSAKSI TERVERIFIKASI LUNAS* ✅
-----------------------------------------
📌 *ID Order:* ${reference_id || '-'}
🆔 *iPaymu Trx ID:* ${trx_id || sid || '-'}
💰 *Dana Masuk:* Rp ${formatHarga}
🟢 *Keamanan:* Terverifikasi Sah Sistem
-----------------------------------------
Kliring pembayaran berhasil diselesaikan. Silakan distribusikan lisensi aplikasi kepada pembeli!`;

            await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: chatId, text: pesanSuksesTelegram, parse_mode: 'Markdown' })
            });
        }

        return res.status(200).send('OK');

    } catch (error) {
        console.error('Callback Notification Error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
}

module.exports = handler;
