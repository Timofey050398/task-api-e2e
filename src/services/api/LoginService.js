/** @typedef {import('../../model/User.ts').User} User */
import 'dotenv/config';
import { LoginClient } from '../../api/clients/LoginClient.js';
import { BaseClient } from '../../api/clients/core/BaseClient.js';
import {AuthCache} from "../../api/clients/core/AuthCache";
import {TelegramService} from "../telegram/TelegramService";
import {step} from "allure-js-commons";
import {MailTmService} from "../mail/MailTmService";

export class LoginService {

    /**
     * @param {User} [user=USER_ONE]
     */
    constructor(user) {
        this.user = user;
        this.loginClient = new LoginClient(false);
        this.mailService = new MailTmService(user);
        this.tgService = new TelegramService(user);
        this.pin = this.user.pin;
    }

    async login() {
        return await step(`🔐 login by user ${this.user.login}`, async () => {
            return await this.#login();
        });
    }

    async changePassword(newPassword = this.user.password) {
        return await step(`🔐 change password to user ${this.user.login}`, async () => {
            return await this.#changePassword(newPassword);
        });
    }

    async #changePassword(newPassword) {
        const login = this.user.login;
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
        const login = this.user.login;
        const password = this.user.password;

        if (!login || !password) {
            throw new Error('TEST_USER_LOGIN and TEST_USER_PASS must be set in env');
        }

        // шаг 1: request
        await this.loginClient.signInRequest(login, password);

        // получить код 2FA
        let code = await this.tgService.getTelegram2FACode(this.user);

        if (!code) {
            throw new Error('2FA code not provided: either supply getCodeFn or set TEST_2FA_CODE in env');
        }

        await this.loginClient.signInConfirm(login, code);

        // шаг 3: finalize (PIN)
        const finalize = await this.loginClient.signInFinalize(this.pin);

        const sseToken = finalize.data?.sseToken ?? null;

        const cookies = this.loginClient.cookies ?? '';

        AuthCache.set({ cookies, sseToken });
        this.baseClient = new BaseClient(this.user);
        this.baseClient.setCookies(cookies);
        this.baseClient.setHeader('x-sse-token', sseToken);

        return {
            cookies,
            sseToken,
            client: this.baseClient,
        };
    }
}