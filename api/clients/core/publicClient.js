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

    async get(url, params = {}) {
        return this.client.get(url, { params });
    }

    async post(url, body = {}) {
        return this.client.post(url, body);
    }

    async put(url, body = {}) {
        return this.client.put(url, body);
    }

    async delete(url) {
        return this.client.delete(url);
    }
}