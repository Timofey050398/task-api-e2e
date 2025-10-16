import {PublicClient} from "../core/PublicClient";
import {RetryInterceptor} from "../core/interceptors/RetryInterceptor";


export class MailTmClient extends PublicClient{
    constructor() {
        super(false,"https://api.mail.tm");
        new RetryInterceptor(this.client, { maxRetries: 3, baseDelay: 1000 })
    }

    async getDomains() {
        return await this.get(`/domains`);
    }

    async createAccount(email, password) {
        return await this.post(`/accounts`, {
            address: email,
            password: password,
        });
    }

    async getToken(email, password) {
        return await this.post(`/token`, {
            address: email,
            password: password,
        });
    }

    setBearerToken(token) {
        this.client.defaults.headers['Authorization'] = `Bearer ${token}`;
    }

    async getMessages(page = 1){
        return await this.get(`/messages?page=${page}`);
    }

    async getMessage(id) {
        return await this.get(`/messages/${id}`);
    }

    async deleteMessage(id) {
        return await this.delete(`/messages/${id}`);
    }

    async downloadMessage(id) {
        return await this.get(`/messages/${id}/download`);
    }
}