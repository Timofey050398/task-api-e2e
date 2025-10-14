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
    async signInRequest(login, password) {
        const payload = { login, password };

        const response = await this.post('/auth/client/sign-in/request', payload);

        const setCookie = response.headers['set-cookie'];
        if (setCookie) {
            this.cookies = setCookie.map(c => c.split(';')[0]).join('; ');
        }

        return response;
    }

    async signInConfirm(login, confirmationCode) {
        const response = await this.post(
            '/auth/client/sign-in/confirm',
            { confirmationCode, login },
            {
                headers: {
                    Cookie: this.cookies,
                },
            },
        );

        const setCookie = response.headers['set-cookie'];
        if (setCookie) {
            this.cookies += '; ' + setCookie.map(c => c.split(';')[0]).join('; ');
        }

        return response;
    }

    async signInFinalize(pin = '0000') {
        return await this.post(
            '/auth/client/sign-in/finalize',
            { PIN: pin },
            {
                headers: {
                    Cookie: this.cookies,
                },
            },
        );
    }
}
