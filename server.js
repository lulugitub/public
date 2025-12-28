const express = require('express');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Webhook'ları env'den al
const getWebhooks = () => {
    const webhooks = [];
    let i = 1;
    
    while (process.env[`webhook${i}`]) {
        webhooks.push(process.env[`webhook${i}`]);
        i++;
    }
    
    return webhooks;
};

// Mesajı env'den al
const MESSAGE = process.env.MESSAGE || "Varsayılan mesaj";

// Tüm webhook'lara mesaj gönder
const sendToAllWebhooks = async () => {
    const webhooks = getWebhooks();
    const results = [];

    console.log(`${webhooks.length} webhook'a mesaj gönderiliyor...`);

    for (const webhook of webhooks) {
        try {
            const response = await axios.post(webhook, {
                content: MESSAGE
            });
            
            results.push({
                webhook: webhook.substring(0, 30) + '...',
                status: 'Başarılı',
                statusCode: response.status
            });
            
            console.log(`✓ ${webhook.substring(0, 30)}... başarılı`);
        } catch (error) {
            results.push({
                webhook: webhook.substring(0, 30) + '...',
                status: 'Başarısız',
                error: error.message
            });
            
            console.log(`✗ ${webhook.substring(0, 30)}... başarısız: ${error.message}`);
        }
    }

    return results;
};

// Ana endpoint
app.get('/', (req, res) => {
    const webhooks = getWebhooks();
    
    res.json({
        status: 'Çalışıyor',
        message: MESSAGE,
        webhookCount: webhooks.length,
        endpoints: {
            send: 'GET /send - Tüm webhook\'lara mesaj gönder',
            status: 'GET /status - Sunucu durumunu kontrol et'
        }
    });
});

// Mesaj gönderme endpoint'i
app.get('/send', async (req, res) => {
    try {
        const results = await sendToAllWebhooks();
        
        res.json({
            success: true,
            message: MESSAGE,
            sentTo: results.length,
            results: results
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Status endpoint'i
app.get('/status', (req, res) => {
    const webhooks = getWebhooks();
    
    res.json({
        status: 'online',
        timestamp: new Date().toISOString(),
        message: MESSAGE,
        webhookCount: webhooks.length,
        webhooks: webhooks.map((wh, index) => ({
            id: index + 1,
            url: wh.substring(0, 50) + '...'
        }))
    });
});

// Health check için basit endpoint
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

app.listen(PORT, () => {
    console.log(`✅ Sunucu http://localhost:${PORT} adresinde çalışıyor`);
    console.log(`📝 Mesaj: "${MESSAGE}"`);
    console.log(`🔗 Webhook sayısı: ${getWebhooks().length}`);
});