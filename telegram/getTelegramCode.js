// telegram/getTelegramCode.js
const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
require('dotenv').config();

const apiId = Number(process.env.TG_API_ID);
const apiHash = process.env.TG_API_HASH;
const botName = process.env.TG_BOT_NAME || 'aifory_pro_bot';
const sessionString = process.env.TG_SESSION;

/**
 * Получает последние сообщения от Telegram-бота
 * и извлекает из них 2FA-код (4–6 цифр)
 */
async function getTelegram2FACode() {
    if (!sessionString) throw new Error('❌ TG_SESSION not found in .env');

    const session = new StringSession(sessionString);
    const client = new TelegramClient(session, apiId, apiHash, { connectionRetries: 5 });

    console.log('[Telegram] Connecting...');
    await client.connect();

    if (!await client.isUserAuthorized()) {
        throw new Error('🔑 Session invalid or expired. Please regenerate TG_SESSION.');
    }

    console.log(`[Telegram] Authorized. Fetching messages from @${botName}...`);
    const messages = await client.getMessages(botName, { limit: 5 });

    const msgWithCode = messages.find(m => /\b\d{4,6}\b/.test(m.message));
    const twoFaCode = msgWithCode?.message.match(/\b\d{4,6}\b/)[0];

    if (twoFaCode) {
        console.log(`[Telegram] ✅ 2FA code found: ${twoFaCode}`);
    } else {
        console.log('[Telegram] ⚠️ No 2FA code found in the last 5 messages.');
    }

    await client.disconnect();
    return twoFaCode;
}

// Позволяет запускать файл напрямую
if (require.main === module) {
    getTelegram2FACode()
        .then(code => console.log('\n📦 Result 2FA code:', code))
        .catch(err => console.error('\n❌ Telegram error:', err.message));
}

module.exports = { getTelegram2FACode };
