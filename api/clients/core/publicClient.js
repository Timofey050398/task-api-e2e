import { config } from '../../config.js';
import axios from "axios";
import {LogInterceptor} from "./interceptors/logInterceptor";

export class PublicClient {
    constructor(baseUrl = config.baseUrl) {
        this.client = axios.create({
            baseURL: baseUrl,
            withCredentials: true,
            headers: {
                'Content-Type': 'application/json',
                'Accept': '*/*',
                'locale': 'ru',
            },
            validateStatus: () => true,
        });
        new LogInterceptor(this.client);
    }

    async get(url, params = {}, options = {}) {
        return this.client.get(url, { params, ...options });
    }

    // options позволяет пробрасывать дополнительные заголовки (например, cookie сессии)
    // для многошаговых сценариев авторизации, где подтверждение должно выполняться в той же сессии.
    async post(url, body = {}, options = {}) {
        return this.client.post(url, body, options);
    }

    async put(url, body = {}, options = {}) {
        return this.client.put(url, body, options);
    }

    async delete(url, options = {}) {
        return this.client.delete(url, options);
    }
}