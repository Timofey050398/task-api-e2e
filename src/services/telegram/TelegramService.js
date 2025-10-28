import "dotenv/config";
import { step, attachment } from "allure-js-commons";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";

const botName = process.env.TG_BOT_NAME || "aifory_pro_bot";

/**
 * @param {User} user
 */
export class TelegramService {
    constructor(user) {
        this.user = user;
    }

    /**
     * Получает последние сообщения от Telegram-бота
     * и извлекает из них 2FA-код (4–6 цифр)
     * Добавляет всё это в Allure как шаг и аттачмент
     */
    async getTelegram2FACode() {
        return await step("📨 Получение 2FA-кода из Telegram", async () => {
            const apiId = this.user.tgApiId;
            const apiHash = this.user.tgHash;
            const sessionString = this.user.tgSession;
            if (!sessionString) throw new Error("❌ TG_SESSION not found in .env");

            const session = new StringSession(sessionString);
            const client = new TelegramClient(session, apiId, apiHash, {
                connectionRetries: 5, requestRetries: 5, timeout: 360000
            });

            console.log("[Telegram] Connecting...");
            await client.connect();

            if (!(await client.isUserAuthorized())) {
                throw new Error("🔑 Session invalid or expired. Please regenerate TG_SESSION.");
            }

            console.log(`[Telegram] Authorized. Fetching messages from @${botName}...`);
            const messages = await client.getMessages(botName, {limit: 5});

            const msgWithCode = messages.find((m) => /\b\d{4,6}\b/.test(m.message));
            const twoFaCode = msgWithCode?.message.match(/\b\d{4,6}\b/)[0];


            if (twoFaCode) {
                console.log(`[Telegram] ✅ 2FA code found: ${twoFaCode}`);
            } else {
                console.log("[Telegram] ⚠️ No 2FA code found in the last 5 messages.");
            }

            const attachmentContent = {
                found: !!twoFaCode,
                code: twoFaCode || null,
                lastMessages: messages.map((m) => m.message),
            };
            await attachment("📩 Telegram 2FA code", JSON.stringify(attachmentContent, null, 2), "application/json");


            await client.disconnect();
            await new Promise(r => setTimeout(r, 1000));
            return twoFaCode;
        });
    }
}