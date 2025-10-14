import {PublicClient} from "./core/publicClient";

export class LoginClient extends PublicClient {
    constructor() {
        super();
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
