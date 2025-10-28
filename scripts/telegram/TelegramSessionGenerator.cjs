// telegram/TelegramSessionGenerator.cjs
const { TelegramClient } = require('telegram');          // ✅ добавляем это
const { StringSession } = require('telegram/sessions');
require('dotenv').config();
const input = require('input');
const {USER_ONE} = require("../../src/constants/Users");

/**
 * Скрипт для получения ключа TG_SESSION.
 * Ключ постоянный, но уникален для аккаунта и IP.
 */
class TelegramSessionGenerator {
    constructor(user = USER_ONE) {
        this.session = new StringSession('');
        this.client = null;
        this.apiId = user.tgApiId;
        this.apiHash = user.tgHash;
        this.phoneNumer = user.phoneNumber;
    }

    async connect() {
        this.client = new TelegramClient(this.session, this.apiId, this.apiHash, {
            connectionRetries: 5
        });
        await this.client.connect();
        console.log('[Telegram] Connected to Telegram servers.');
    }

    async generateSession() {
        if (await this.client.isUserAuthorized()) {
            console.log('[Telegram] Already authorized.');
            return this.client.session.save();
        }
        const apiId = this.apiId;
        const apiHash = this.apiHash;
        const phoneNumber = this.phoneNumer;

        console.log('[Telegram] Not authorized — performing sign-in...');
        const sendCodeResult = await this.client.sendCode({ apiId, apiHash }, phoneNumber);
        const codeType = sendCodeResult?.type?._ || 'unknown';
        console.log(`[Telegram] Code delivery type: ${codeType}`);

        const timeout = new Promise(resolve => setTimeout(resolve, 30000, null));
        const userInput = input.text('Enter Telegram login code (from SMS or app): ');
        const result = await Promise.race([userInput, timeout]);

        let code = result?.trim();
        if (!code) {
            console.log('[Telegram] ⏳ No code entered in 30s — requesting resend...');
            await this.client.resendCode({ phoneNumber, phoneCodeHash: sendCodeResult.phoneCodeHash });
            code = (await input.text('Enter Telegram login code (resend): ')).trim();
        }

        const user = await this.client.signInUser(
            { apiId, apiHash },
            {
                phoneNumber: async () => phoneNumber,
                phoneCode: async () => code,
                onError: async (err) => {
                    console.error('[Telegram Auth Error]', err.message);
                    return false;
                }
            }
        );

        console.log(`[Telegram] ✅ Logged in as ${user?.username || 'user'}`);

        const stringSession = this.client.session.save();
        console.log('\n🔐 Your TG_SESSION:\n');
        console.log(stringSession, '\n');

        await this.client.disconnect();
        return stringSession;
    }
}

if (require.main === module) {
    (async () => {
        const generator = new TelegramSessionGenerator();
        await generator.connect();
        await generator.generateSession();
    })();
}

module.exports = { TelegramSessionGenerator };