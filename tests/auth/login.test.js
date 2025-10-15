import { LoginService } from "../../services/api/LoginService";
import { expect, test } from "@playwright/test";
import { LoginClient, INVALID_CONFIRMATION_CODE, INVALID_LOGIN_OR_PASSWORD } from "../../api/clients/LoginClient";
import {generateEmail, generatePassword} from "../../utils/randomGenerator";
import {assertCode, assertEquals} from "../../utils/allureUtils";
import {step} from "allure-js-commons";
import {USER_ONE} from "../../constants/Users";

const user = USER_ONE;

test.describe('login flow', () => {
    test.setTimeout(60000);
    test('should successfully login', async () => {
        await new LoginService(user).login();
    });
    test('should get error when password wrong', async () => {
        const client = new LoginClient();
        const login = user.login;
        const password = generatePassword();

        const response = await client.signInRequest(login, password);

        await step('assert login response', async () => {
            await assertCode(response.status, 400);
            await assertEquals(response.data.message, INVALID_LOGIN_OR_PASSWORD, 'error message ');
        });
    });
    test('should get error when login wrong', async () => {
        const client = new LoginClient();
        const login = generateEmail();
        const password = user.password;

        const response = await client.signInRequest(login, password);

        await step('assert login response', async () => {
            await assertCode(response.status, 400);
            await assertEquals(response.data.message, INVALID_LOGIN_OR_PASSWORD, 'error message ');
        });
    });

    test('should get error when tg code wrong', async () => {
        const client = new LoginClient();
        const login = user.login;
        const password = user.password;
        const responseSignIn = await client.signInRequest(login, password);
        expect(responseSignIn.status).toBe(200);

        const response = await client.signInConfirm(login, '111111');

        await step('assert sing in confirm response',async () =>
        {
            await assertCode(response.status, 400);
            await assertEquals(response.data.message, INVALID_CONFIRMATION_CODE, 'error message ')
        });
    });
});