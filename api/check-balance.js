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
    try {
        const va = process.env.IPAYMU_VA;
        const apiKey = process.env.IPAYMU_KEY;
        const isProduction = process.env.IPAYMU_SANDBOX !== 'true';

        const bodyEncrypt = JSON.stringify({});
        const requestBodyHash = crypto.createHash('sha256').update(bodyEncrypt).digest('hex').toLowerCase();
        const stringToSign = `POST:${va}:${requestBodyHash}:${apiKey}`;
        const signature = crypto.createHmac('sha256', apiKey).update(stringToSign).digest('hex');

        const url = isProduction 
            ? 'https://my.ipaymu.com/api/v2/balance' 
            : 'https://sandbox.ipaymu.com/api/v2/balance';

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'va': va, 'signature': signature },
            body: bodyEncrypt
        });

        const data = await response.json();
        if (data.Status === 200) {
            return res.status(200).json({
                success: true,
                merchant_va: va,
                balance: data.Data.Balance,
                formatted_balance: "Rp " + parseInt(data.Data.Balance).toLocaleString('id-ID')
            });
        } else {
            return res.status(400).json({ success: false, message: data.Message });
        }
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
}

module.exports = allowCors(handler);
