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

// Interval süresi (ms) - varsayılan: 5 saniye
const INTERVAL = parseInt(process.env.INTERVAL) || 5000;

// Spam durumu
let isSpamming = false;
let spamInterval = null;
let totalSent = 0;

// Tek webhook'a mesaj gönder
const sendToWebhook = async (webhook, message) => {
    try {
        const response = await axios.post(webhook, {
            content: message,
            timestamp: new Date().toISOString()
        });
        
        totalSent++;
        return {
            success: true,
            webhook: webhook.substring(0, 30) + '...',
            status: response.status,
            timestamp: new Date().toLocaleTimeString()
        };
    } catch (error) {
        return {
            success: false,
            webhook: webhook.substring(0, 30) + '...',
            error: error.message,
            timestamp: new Date().toLocaleTimeString()
        };
    }
};

// Tüm webhook'lara mesaj gönder
const spamAllWebhooks = async () => {
    if (!isSpamming) return;
    
    const webhooks = getWebhooks();
    console.log(`🔄 ${webhooks.length} webhook'a mesaj gönderiliyor... (Toplam: ${totalSent})`);
    
    const promises = webhooks.map(webhook => sendToWebhook(webhook, MESSAGE));
    const results = await Promise.allSettled(promises);
    
    // Başarılı/başarısız sayılarını hesapla
    const successful = results.filter(r => r.value?.success).length;
    const failed = results.filter(r => !r.value?.success).length;
    
    console.log(`✅ Başarılı: ${successful} | ❌ Başarısız: ${failed} | 📊 Toplam: ${totalSent}`);
    
    return {
        successful,
        failed,
        total: webhooks.length,
        timestamp: new Date().toLocaleTimeString()
    };
};

// Spam'i başlat
const startSpam = () => {
    if (isSpamming) {
        return { success: false, message: 'Zaten spam yapılıyor' };
    }
    
    isSpamming = true;
    totalSent = 0;
    
    console.log('🔥 SPAM BAŞLATILDI!');
    console.log(`📝 Mesaj: "${MESSAGE}"`);
    console.log(`⏱️  Interval: ${INTERVAL}ms`);
    console.log(`🔗 Webhook sayısı: ${getWebhooks().length}`);
    
    // Hemen ilk gönderimi yap
    spamAllWebhooks();
    
    // Interval'i başlat
    spamInterval = setInterval(spamAllWebhooks, INTERVAL);
    
    return {
        success: true,
        message: 'Spam başlatıldı',
        interval: INTERVAL,
        webhookCount: getWebhooks().length
    };
};

// Spam'i durdur
const stopSpam = () => {
    if (!isSpamming) {
        return { success: false, message: 'Spam zaten durdurulmuş' };
    }
    
    isSpamming = false;
    if (spamInterval) {
        clearInterval(spamInterval);
        spamInterval = null;
    }
    
    console.log('🛑 SPAM DURDURULDU!');
    return {
        success: true,
        message: 'Spam durduruldu',
        totalSent: totalSent
    };
};

// Ana endpoint
app.get('/', (req, res) => {
    const webhooks = getWebhooks();
    
    res.json({
        status: 'Çalışıyor',
        spamStatus: isSpamming ? 'AKTİF 🔥' : 'DURDU 🛑',
        message: MESSAGE,
        interval: `${INTERVAL}ms`,
        webhookCount: webhooks.length,
        totalSent: totalSent,
        endpoints: {
            start: 'GET /start - Spam başlat',
            stop: 'GET /stop - Spam durdur',
            status: 'GET /status - Detaylı durum',
            send: 'GET /send - Tek seferlik gönderim'
        }
    });
});

// Spam başlatma endpoint'i
app.get('/start', (req, res) => {
    const result = startSpam();
    res.json(result);
});

// Spam durdurma endpoint'i
app.get('/stop', (req, res) => {
    const result = stopSpam();
    res.json(result);
});

// Tek seferlik gönderim
app.get('/send', async (req, res) => {
    const result = await spamAllWebhooks();
    res.json({
        success: true,
        message: 'Tek seferlik gönderim yapıldı',
        result: result
    });
});

// Status endpoint'i
app.get('/status', (req, res) => {
    const webhooks = getWebhooks();
    
    res.json({
        spamStatus: isSpamming ? 'AKTİF 🔥' : 'DURDU 🛑',
        timestamp: new Date().toISOString(),
        message: MESSAGE,
        interval: INTERVAL,
        webhookCount: webhooks.length,
        totalSent: totalSent,
        webhooks: webhooks.map((wh, index) => ({
            id: index + 1,
            url: wh.substring(0, 50) + '...'
        }))
    });
});

// Spam durumunu toggle et
app.get('/toggle', (req, res) => {
    if (isSpamming) {
        const result = stopSpam();
        res.json({ action: 'stopped', ...result });
    } else {
        const result = startSpam();
        res.json({ action: 'started', ...result });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// Sunucuyu başlat
app.listen(PORT, () => {
    console.log(`✅ Sunucu http://localhost:${PORT} adresinde çalışıyor`);
    console.log(`📝 Mesaj: "${MESSAGE}"`);
    console.log(`🔗 Webhook sayısı: ${getWebhooks().length}`);
    
    // Otomatik başlatma
    if (process.env.AUTO_START === 'true') {
        console.log('🚀 AUTO_START aktif, spam başlatılıyor...');
        setTimeout(() => startSpam(), 2000);
    }
});
