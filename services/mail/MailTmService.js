import {MailTmClient} from "../../api/clients/mail/MailTmClient";

export class MailTmService {
    constructor(email = null, password = null) {
        this.email = email;
        this.password = password;
        this.token = null;
        this.client = new MailTmClient();
    }

    /**
     * Инициализация: если email не задан — генерирует новый ящик
     */
    async init() {
        if (!this.email || !this.password) {
            const { data: domainData } = await this.client.getDomains();
            const domain = domainData["hydra:member"][0].domain;

            this.email = this.email ?? `user_${Date.now()}@${domain}`;
            this.password = this.password ?? Math.random().toString(36).slice(-10) + "!1a";

            await this.client.createAccount(this.email, this.password);
        }

        // Авторизация
        const { data } = await this.client.getToken(this.email,this.password);

        this.client.setBearerToken(data.token);

        console.log(`📧 Mailbox ready: ${this.email}`);
        return { email: this.email, password: this.password, token: this.token };
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
}