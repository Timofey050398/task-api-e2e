import { PublicClient } from "../core/PublicClient.js";

/**
 * Клиент для Mailgun REST API.
 * Поддерживает работу с маршрутами (routes), доменами и сообщениями (events).
 */
export class MailgunClient extends PublicClient {
    constructor(apiKey) {
        super(false, `https://api.mailgun.net`);
        const token = Buffer.from(`api:${apiKey}`).toString("base64");
        this.domain = process.env.MAILGUN_DOMAIN;
        this.client.defaults.headers["Authorization"] = `Basic ${token}`;
    }

    /** Получить список доменов */
    async getDomains() {
        return await this.get(`/v4/domains`);
    }

    /** Получить информацию по конкретному домену */
    async getDomainInfo() {
        return await this.get(`https://api.mailgun.net/v4/domains/${this.domain}`);
    }

    /** Создать inbound route (для приёма писем) */
    async createRoute(priority, description, expression, action) {
        return await this.post(`https://api.mailgun.net/v3/routes`, {
            priority,
            description,
            expression, // например: 'match_recipient("inbox@mydomain.com")'
            action,     // например: ['store()', 'forward("https://yourapp/inbound")']
        });
    }

    /** Получить список маршрутов (routes) */
    async getRoutes(limit = 100) {
        return await this.get(`/v3/routes?limit=${limit}`);
    }

    /** Удалить маршрут */
    async deleteRoute(id) {
        return await this.delete(`/v3/routes/${id}`);
    }

    /** Получить события (входящие письма, доставки и т.д.) */
    async getEvents(params = {}) {
        const query = new URLSearchParams(params).toString();
        return await this.get(`/v3/${this.domain}/events?${query}`);
    }

    /** Получить конкретное сообщение по ID */
    async getMessage(id) {
        return await this.get(`/v3/domains/${this.domain}/messages/${id}`);
    }
}