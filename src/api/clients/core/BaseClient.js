import { config } from '../../config.js';
import { AuthCache } from './AuthCache.js';
import { LoginService } from '../../../services/api/LoginService.js';
import axios from "axios";
import {LogInterceptor} from "./interceptors/LogInterceptor";
import {AllureAxiosInterceptor} from "./interceptors/AllureAxiosInterceptor";

/**
 * aвторизованный базовый axios клиент
 */
export class BaseClient {
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
        new AllureAxiosInterceptor(this.client);
    }

    async initAuthIfNeeded() {
        if (!AuthCache.cookies || !AuthCache.sseToken) {
            console.log('[BaseClient] Auth missing, performing login...');
            const loginService = new LoginService();
            const { cookies, sseToken } = await loginService.login();
            AuthCache.set({ cookies, sseToken });
        }

        if (AuthCache.cookies) {
            this.setCookies(AuthCache.cookies);
        }
        if (AuthCache.sseToken) {
            this.setHeader('x-sse-token', AuthCache.sseToken);
        }
    }

    setCookies(cookieString) {
        if (!cookieString) {
            delete this.client.defaults.headers.common['Cookie'];
        } else {
            this.client.defaults.headers.common['Cookie'] = cookieString;
        }
    }

    setHeader(name, value) {
        if (!value) {
            delete this.client.defaults.headers.common[name];
        } else {
            this.client.defaults.headers.common[name] = value;
        }
    }

    async get(url, params = {}, options = {}) {
        await this.initAuthIfNeeded();
        return this.client.get(url, { params, ...options });
    }

    async post(url, body = {}, options = {}) {
        await this.initAuthIfNeeded();
        return this.client.post(url, body, options);
    }

    async put(url, body = {}, options = {}) {
        await this.initAuthIfNeeded();
        return this.client.put(url, body, options);
    }

    async delete(url, options = {}) {
        await this.initAuthIfNeeded();
        return this.client.delete(url, options);
    }
}