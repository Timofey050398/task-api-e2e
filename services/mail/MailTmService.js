import {MailTmClient} from "../../api/clients/mail/MailTmClient";
import {attachment} from "allure-js-commons";
import {decodeMessage} from "../../utils/messageDecoder";

export class MailTmService {
    constructor(email = process.env.MAILTM_EMAIL, password = process.env.TEST_USER_PASS) {
        this.email = email;
        this.password = password;
        this.client = new MailTmClient();
    }

    /**
     * Инициализация: если email не задан — генерирует новый ящик
     */
    async init() {
        if (!this.email) {
            const { data: domainData } = await this.client.getDomains();
            const domain = domainData["hydra:member"][0].domain;

            this.email = `user_${Date.now()}@${domain}`;

            await this.client.createAccount(this.email, this.password);
        }

        // Авторизация
        const { data } = await this.client.getToken(this.email,this.password);

        this.client.setBearerToken(data.token);

        console.log(`📧 Mailbox ready: ${this.email}`);
        return { email: this.email, password: this.password };
    }

    /**
     * Получить список сообщений
     */
    async getMessages(limit = 5) {
        if (!this.client) throw new Error("Call init() first");
        const { data } = await this.client.getMessages();
        return data["hydra:member"].slice(0, limit);
    }

    /**
     * Получить последнее письмо
     */
    async getLastMessage() {
        const messages = await this.getMessages(1);
        if (messages.length === 0) {
            console.log("📭 No messages yet");
            return null;
        }

        const msgId = messages[0].id;
        const { data } = await this.client.getMessage(msgId);
        console.log(`📨 Last message from ${data.from.address}: ${data.subject}`);
        return data;
    }

    async getLastCode(timeoutMs = 30000, interval = 2000) {
        const message = await this.waitForLastMessage(timeoutMs,interval);
        if (!message) return null;

        const { data } = await this.client.downloadMessage(message.id);

        const { html, code } = decodeMessage(data);

        if (code) {
            console.log(`[MailTm] ✅ code found: ${code}`);
        } else {
            console.log("[MailTm] ⚠️ No code found in the last message.");
        }

        const attachmentContent = {
            found: !!code,
            code: code || null,
            html: html,
        };

        await attachment(
            "📩 MailTm code",
            JSON.stringify(attachmentContent, null, 2),
            "application/json"
        );

        return code;
    }

    async waitForLastMessage(timeoutMs = 30000, interval = 2000) {
        const start = Date.now();

        while (Date.now() - start < timeoutMs) {
            const messages = await this.getMessages(1);
            if (messages.length > 0) {
                const msg = messages[0];
                const received = new Date(msg.updatedAt).getTime();
                if (received > start) {
                    console.log(`📩 New message detected (${msg.id}) at ${msg.createdAt}`);
                    return msg;
                }
            }
            await new Promise(r => setTimeout(r, interval));
        }

        console.log("⏰ Timeout waiting for message");
        return null;
    }


    async clearLastMessage() {
        const messages = await this.getMessages(1);
        if (messages.length === 0) {
            console.log("📭 No messages yet");
            return null;
        }

        const msgId = messages[0].id;
        await this.client.deleteMessage(msgId);
    }

    /**
     * Удалить все письма (опционально)
     */
    async clearInbox() {
        const messages = await this.getMessages(50);
        for (const msg of messages) {
            await this.client.deleteMessage(msg.id);
        }
        console.log("🧹 Inbox cleared");
    }

    async getLastCodeWithClear() {
        let code;
        try {
            code = await this.getLastCode();
        } finally {
            await this.clearInbox();
        }

        if (!code) {
            throw new Error('mail code does not found');
        }
        return code;
    }
}