const fetch = require('node-fetch');
const crypto = require('crypto');

function allowCors(fn) {
    return async (req, res) => {
        res.setHeader('Access-Control-Allow-Credentials', true);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
        if (req.method === 'OPTIONS') return res.status(200).end();
        return await fn(req, res);
    };
}

async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, message: 'Gunakan metode GET dengan parameter query' });
    }

    try {
        const { trx_id } = req.query;
        if (!trx_id) {
            return res.status(400).json({ success: false, message: 'Parameter query ?trx_id= wajib dilampirkan.' });
        }

        const va = process.env.IPAYMU_VA ? process.env.IPAYMU_VA.trim() : '';
        const apiKey = process.env.IPAYMU_KEY ? process.env.IPAYMU_KEY.trim() : '';
        const isProduction = process.env.IPAYMU_SANDBOX !== 'true';

        const body = { transactionId: parseInt(trx_id) };
        const bodyEncrypt = JSON.stringify(body);
        const requestBodyHash = crypto.createHash('sha256').update(bodyEncrypt).digest('hex').toLowerCase();
        const stringToSign = `POST:${va}:${requestBodyHash}:${apiKey}`;
        const signature = crypto.createHmac('sha256', apiKey).update(stringToSign).digest('hex');

        const url = isProduction 
            ? 'https://my.ipaymu.com/api/v2/transaction' 
            : 'https://sandbox.ipaymu.com/api/v2/transaction';

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'va': va, 'signature': signature },
            body: bodyEncrypt
        });

        const data = await response.json();
        if (data.Status === 200) {
            return res.status(200).json({
                success: true,
                data: {
                    trx_id: data.Data.TransactionId,
                    reference_id: data.Data.ReferenceId,
                    amount: data.Data.Amount,
                    status: data.Data.Status, 
                    status_desc: data.Data.StatusDesc,
                    payment_channel: data.Data.PaymentChannel,
                    buyer_name: data.Data.BuyerName
                }
            });
        } else {
            return res.status(400).json({ success: false, message: data.Message || 'Data transaksi tidak ditemukan.' });
        }
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
}

module.exports = allowCors(handler);
