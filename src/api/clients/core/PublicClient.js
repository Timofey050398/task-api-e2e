import { config } from '../../config.js';
import axios from "axios";
import {LogInterceptor} from "./interceptors/LogInterceptor";
import {AllureAxiosInterceptor} from "./interceptors/AllureAxiosInterceptor";

/**
 * Не авторизованный базовый axios клиент
 */
export class PublicClient {
    constructor(processErrors = true, baseUrl = config.baseUrl) {
        this.client = axios.create({
            baseURL: baseUrl,
            withCredentials: true,
            headers: {
                'Content-Type': 'application/json',
                'Accept': '*/*',
                'locale': 'ru',
            },
            validateStatus: (status) =>
                processErrors ? true : status >= 200 && status < 300,
        });
        new LogInterceptor(this.client);
        new AllureAxiosInterceptor(this.client);
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