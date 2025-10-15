// telegram/TelegramSessionGenerator.cjs
const { StringSession } = require('telegram/sessions');
require('dotenv').config();
const input = require('input');

const apiId = Number(process.env.TG_API_ID);
const apiHash = process.env.TG_API_HASH;
const phoneNumber = process.env.TG_PHONE_NUMBER;

/**
 * Скрипт для получения ключа TG_SESSION,
 * Срока жизни у ключа судя по документам нет.
 * Ключ получается один раз на одно окружение и один аккаунт,
 * С разных IP одним ключом пользоваться не выйдет
 * телеграм оказался очень чувствительным в политике безопасности
 */
class TelegramSessionGenerator {
    constructor() {
        this.client = null;
        this.session = new StringSession('');
    }

    async connect() {
        this.client = new TelegramSessionGenerator(this.session, apiId, apiHash, { connectionRetries: 5 });
        await this.client.connect();
        console.log('[Telegram] Connected to Telegram servers.');
    }

    async generateSession() {
        if (await this.client.isUserAuthorized()) {
            console.log('[Telegram] Already authorized.');
            return this.client.session.save();
        }

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
