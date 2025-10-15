import { LoginService } from "../../services/api/LoginService";
import { test } from "@playwright/test";
import {
    LoginClient,
    INVALID_LOGIN_OR_PASSWORD,
    LOGIN_OR_MAIL_NOT_EXIST,
    INVALID_LOGIN_OR_CODE
} from "../../api/clients/LoginClient";
import {generateEmail, generatePassword} from "../../utils/randomGenerator";
import {assertCode, assertEquals} from "../../utils/allureUtils";
import {step} from "allure-js-commons";
import {MailTmService} from "../../services/mail/MailTmService";

test.describe('change password flow', () => {
    test.setTimeout(60000);
    test('should successfully change password', async () => {
        await new LoginService().changePassword();
    });
    test('should get error when reset email not valid', async () => {
        const client = new LoginClient();
        const login = generatePassword();

        const response = await client.resetPassword(login);

        await step('assert reset password response', async () => {
            await assertCode(response.status, 400);
            await assertEquals(response.data.message, LOGIN_OR_MAIL_NOT_EXIST, 'error message ');
        });
    });
    test('should get error when reset email not found', async () => {
        const client = new LoginClient();
        const login = generateEmail();

        const response = await client.resetPassword(login);

        await step('assert reset password response', async () => {
            await assertCode(response.status, 400);
            await assertEquals(response.data.message, LOGIN_OR_MAIL_NOT_EXIST, 'error message ');
        });
    });
    test('should get error when code wrong', async () => {
        const client = new LoginClient();
        const login = process.env.TEST_USER_LOGIN;
        const resetPasswordResponse = await client.resetPassword(login);
        await assertCode(resetPasswordResponse.status, 200);

        const response = await client.getResetPasswordToken(login,"111111");
        await step('assert get reset password token response', async () => {
            await assertCode(response.status, 400);
            await assertEquals(response.data.message, INVALID_LOGIN_OR_CODE, 'error message ');
        });
    });

    test('should get error when code old', async () => {
        const loginClient = new LoginClient();
        const mailService = new MailTmService();
        const login = process.env.TEST_USER_LOGIN;
        await mailService.init();
        let resetPasswordResponse = await loginClient.resetPassword(login);
        await assertCode(resetPasswordResponse.status, 200);
        const oldCode = await mailService.getLastCodeWithClear();
        resetPasswordResponse = await loginClient.resetPassword(login);
        await assertCode(resetPasswordResponse.status, 200);
        await mailService.getLastCodeWithClear();

        const response = await loginClient.getResetPasswordToken(login,oldCode);
        await step('assert get reset password token response', async () => {
            await assertCode(response.status, 400);
            await assertEquals(response.data.message, INVALID_LOGIN_OR_CODE, 'error message ');
        });
    });

    test('should get error when password incorrect', async () => {
        const loginClient = new LoginClient();
        const mailService = new MailTmService();
        const login = process.env.TEST_USER_LOGIN;
        await mailService.init();

        let resetPasswordResponse = await loginClient.resetPassword(login);
        await assertCode(resetPasswordResponse.status, 200);

        const code = await mailService.getLastCodeWithClear();
        const resetPasswordTokenResponse = await loginClient.getResetPasswordToken(login,code);
        await assertCode(resetPasswordTokenResponse.status, 200);
        const token = resetPasswordTokenResponse.data.token;

        const response = await loginClient.changePassword("@@$#%#%", token);

        try {
            if (response.status === 200) {
                await new LoginService().changePassword();
            }
        } finally {
            await step('assert get reset password token response', async () => {
                await assertCode(response.status, 400);
                await assertEquals(response.data.message, INVALID_LOGIN_OR_PASSWORD, 'error message ');
            });
        }
    });
});