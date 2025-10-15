import 'dotenv/config';
import { LoginClient } from '../../api/clients/LoginClient.js';
import { BaseClient } from '../../api/clients/core/BaseClient.js';
import {AuthCache} from "../../api/clients/core/AuthCache";
import {getTelegram2FACode} from "../telegram/getTelegramCode";
import {step} from "allure-js-commons";
import {MailTmService} from "../mail/MailTmService";

export class LoginService {
    /**
     * @param {object} options
     * @param {string} [options.pin] - PIN для finalize (по умолчанию env TEST_PIN).
     */
    constructor({pin = process.env.TEST_PIN } = {}) {
        this.loginClient = new LoginClient(false);
        this.baseClient = new BaseClient();
        this.mailService = new MailTmService();
        this.pin = pin;
    }

    async login() {
        return await step(`🔐 login by user ${process.env.TEST_USER_LOGIN}`, async () => {
            return await this.#login();
        });
    }

    async changePassword() {
        return await step(`🔐 change password to user ${process.env.TEST_USER_LOGIN}`, async () => {
            return await this.#changePassword();
        });
    }

    async #changePassword(newPassword = process.env.TEST_USER_PASS) {
        const login = process.env.TEST_USER_LOGIN;
        await this.mailService.init();

        await this.loginClient.resetPassword(login);
        const code = await this.mailService.getLastCodeWithClear();

        const getTokenResponse = await this.loginClient.getResetPasswordToken(login,code);

        const token = getTokenResponse.data.token;

        if (!token) {
            throw new Error('token not found');
        }

        await this.loginClient.changePassword(newPassword, token);
    }

    async #login() {
        const login = process.env.TEST_USER_LOGIN;
        const password = process.env.TEST_USER_PASS;

        if (!login || !password) {
            throw new Error('TEST_USER_LOGIN and TEST_USER_PASS must be set in env');
        }

        // шаг 1: request
        await this.loginClient.signInRequest(login, password);

        // получить код 2FA
        let code = await getTelegram2FACode();

        if (!code) {
            throw new Error('2FA code not provided: either supply getCodeFn or set TEST_2FA_CODE in env');
        }

        await this.loginClient.signInConfirm(login, code);

        // шаг 3: finalize (PIN)
        const finalize = await this.loginClient.signInFinalize(this.pin);

        const sseToken = finalize.data?.sseToken ?? null;

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