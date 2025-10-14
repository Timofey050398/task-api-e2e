import 'dotenv/config';
import { LoginClient } from '../clients/loginClient.js';
import { BaseClient } from '../clients/core/baseClient.js';
import {AuthCache} from "../utils/AuthCache";
import {getTelegram2FACode} from "../../telegram/getTelegramCode";

export class LoginService {
    /**
     * @param {object} options
     * @param {string} [options.pin] - PIN для finalize (по умолчанию env TEST_PIN).
     */
    constructor({pin = process.env.TEST_PIN } = {}) {
        this.loginClient = new LoginClient();
        this.baseClient = new BaseClient();
        this.pin = pin;
    }

    async login() {
        const login = process.env.TEST_USER_LOGIN;
        const password = process.env.TEST_USER_PASS;

        if (!login || !password) {
            throw new Error('TEST_USER_LOGIN and TEST_USER_PASS must be set in env');
        }

        // шаг 1: request
        const signInResponse = await this.loginClient.signInRequest(login, password);

        if (signInResponse.status  !== 200) {
            throw Error(`Failed to login ${JSON.stringify(signInResponse.data)}`);
        }

        // получить код 2FA
        let code = await getTelegram2FACode();

        if (!code) {
            throw new Error('2FA code not provided: either supply getCodeFn or set TEST_2FA_CODE in env');
        }

        const confirmResponse = await this.loginClient.signInConfirm(login, code);

        if (confirmResponse.status  !== 200) {
            throw Error(`Failed to confirm code ${JSON.stringify(confirmResponse.data)}`);
        }

        // шаг 3: finalize (PIN)
        const finalize = await this.loginClient.signInFinalize(this.pin);

        const finalizeData = finalize.data;

        if (finalize.status  !== 200) {
            throw Error(`Failed to confirm pin ${JSON.stringify(finalizeData)}`);
        }

        const sseToken = finalizeData?.sseToken ?? null;

        const cookies = this.loginClient.cookies ?? '';

        AuthCache.set({ cookies, sseToken });
        this.baseClient.setCookies(cookies);
        this.baseClient.setHeader('x-sse-token', sseToken);

        return {
            cookies,
            sseToken,
            client: this.baseClient,
        };
    }
}