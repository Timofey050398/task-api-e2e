import {PublicClient} from "./core/PublicClient";

export const INVALID_CONFIRMATION_CODE = 'INVALID_CONFIRMATION_CODE';
export const INVALID_LOGIN_OR_PASSWORD = 'INVALID_LOGIN_OR_PASSWORD';
export const LOGIN_OR_MAIL_NOT_EXIST = 'LOGIN_OR_MAIL_NOT_EXIST';
export const INVALID_LOGIN_OR_CODE = 'INVALID_LOGIN_OR_CODE';

export class LoginClient extends PublicClient {
    constructor(processErrors = true) {
        super(processErrors);
        this.cookies = '';
    }

    /**
     * Отправляет логин-запрос
     * @param {string} login
     * @param {string} password
     * @returns {Promise<AxiosResponse>}
     */
    async signInRequest(login, password, options = {}) {
        const payload = { login, password };

        const response = await this.post('/auth/client/sign-in/request', payload, options);

        const setCookie = response.headers['set-cookie'];
        if (setCookie) {
            this.cookies = this.#mergeCookies(setCookie);
        }

        return response;
    }

    async signInConfirm(login, confirmationCode, options = {}) {
        const response = await this.post(
            '/auth/client/sign-in/confirm',
            { confirmationCode, login },
            this.#withSessionHeaders(options),
        );

        const setCookie = response.headers['set-cookie'];
        if (setCookie) {
            this.cookies = this.#mergeCookies(setCookie, this.cookies);
        }

        return response;
    }

    async signInFinalize(pin = '0000', options = {}) {
        return await this.post(
            '/auth/client/sign-in/finalize',
            { PIN: pin },
            this.#withSessionHeaders(options),
        );
    }

    async resetPassword(login, options = {}) {
        return await this.post(
            '/email/reset_password',
            {login : login},
            this.#withSessionHeaders(options),
            );
    }

    async getResetPasswordToken(login, code, options = {}) {
        return await this.post(
            '/email/get_reset_password_token',
            {
                login : login,
                code : code
            },
            this.#withSessionHeaders(options),
        );
    }

    async changePassword(password, uuid, options = {}) {
        return await this.post(
            '/auth/client/change_password',
            {
                password : password,
                uuid : uuid
            },
            this.#withSessionHeaders(options),
        );
    }

    #withSessionHeaders(options = {}) {
        const headers = { ...(options.headers ?? {}) };

        if (this.cookies && headers.Cookie === undefined) {
            headers.Cookie = this.cookies;
        }

        return { ...options, headers };
    }

    #mergeCookies(newCookies, existing = '') {
        const serialized = newCookies.map(c => c.split(';')[0]).join('; ');

        if (!existing) {
            return serialized;
        }

        return [existing, serialized].filter(Boolean).join('; ');
    }
}
