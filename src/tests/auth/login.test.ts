import { expect, test } from "../../fixtures/userPool";
import {INVALID_CONFIRMATION_CODE, INVALID_LOGIN_OR_PASSWORD} from "../../api/clients/LoginClient";
import {generateEmail, generatePassword} from "../../utils/randomGenerator";
import {assertCode, assertEquals} from "../../utils/allureUtils";
import {step} from "allure-js-commons";

test.describe('login flow', () => {
    test.setTimeout(60000);

    test('should successfully login', async ({ loginService }) => {
        await loginService.login();
    });

    test('should get error when password wrong', async ({ user , api }) => {
        const login = user.login;
        const password = generatePassword();

        const response = await api.login.signInRequest(login, password);

        await step('assert login response', async () => {
            await assertCode(response.status, 400);
            await assertEquals(response.data.message, INVALID_LOGIN_OR_PASSWORD, 'error message');
        });
    });

    test('should get error when login wrong', async ({ user, api }) => {
        const login = generateEmail();

        const response = await api.login.signInRequest(login, user.password);

        await step('assert login response', async () => {
            await assertCode(response.status, 400);
            await assertEquals(response.data.message, INVALID_LOGIN_OR_PASSWORD, 'error message');
        });
    });

    test('should get error when tg code wrong', async ({ user, api }) => {
        const login = user.login;

        const responseSignIn = await api.login.signInRequest(login, user.password);
        expect(responseSignIn.status).toBe(200);

        const response = await api.login.signInConfirm(login, '111111');

        await step('assert sign in confirm response', async () => {
            await assertCode(response.status, 400);
            await assertEquals(response.data.message, INVALID_CONFIRMATION_CODE, 'error message');
        });
    });
});