import { test } from "../../fixtures/userPool";
import {
    INVALID_LOGIN_OR_PASSWORD,
    LOGIN_OR_MAIL_NOT_EXIST,
    INVALID_LOGIN_OR_CODE
} from "../../api/clients/LoginClient";
import {generateEmail, generatePassword} from "../../utils/randomGenerator";
import {assertCode, assertEquals} from "../../utils/allureUtils";
import {step} from "allure-js-commons";

test.describe('change password flow', () => {
    test.setTimeout(60000);
    test('should get error when reset email not valid', async ({api}) => {
        const login = generatePassword();

        const response = await api.login.resetPassword(login);

        await step('assert reset password response', async () => {
            await assertCode(response.status, 400);
            await assertEquals(response.data.message, LOGIN_OR_MAIL_NOT_EXIST, 'error message ');
        });
    });
    test('should get error when reset email not found', async ({api}) => {
        const login = generateEmail();

        const response = await api.login.resetPassword(login);

        await step('assert reset password response', async () => {
            await assertCode(response.status, 400);
            await assertEquals(response.data.message, LOGIN_OR_MAIL_NOT_EXIST, 'error message ');
        });
    });
    test('should successfully change password', async ({ loginService }) => {
        await loginService.changePassword();
    });
    test('should get error when code wrong', async ({ user, api }) => {
        const login = user.login;
        const resetPasswordResponse = await api.login.resetPassword(login);
        await assertCode(resetPasswordResponse.status, 200);

        const response = await api.login.getResetPasswordToken(login,"111111");
        await step('assert get reset password token response', async () => {
            await assertCode(response.status, 400);
            await assertEquals(response.data.message, INVALID_LOGIN_OR_CODE, 'error message ');
        });
    });

    test('should get error when code old', async ({ user, api, mailService }) => {
        const login = user.login;
        await mailService.init();
        let resetPasswordResponse = await api.login.resetPassword(login);
        await assertCode(resetPasswordResponse.status, 200);
        const oldCode = await mailService.getLastCodeWithClear();
        resetPasswordResponse = await api.login.resetPassword(login);
        await assertCode(resetPasswordResponse.status, 200);
        await mailService.getLastCodeWithClear();

        const response = await api.login.getResetPasswordToken(login,oldCode);
        await step('assert get reset password token response', async () => {
            await assertCode(response.status, 400);
            await assertEquals(response.data.message, INVALID_LOGIN_OR_CODE, 'error message ');
        });
    });

    test('should get error when password incorrect', async ({ user , loginService , api, mailService }) => {
        const login = user.login;
        await mailService.init();

        let resetPasswordResponse = await api.login.resetPassword(login);
        await assertCode(resetPasswordResponse.status, 200);

        const code = await mailService.getLastCodeWithClear();
        const resetPasswordTokenResponse = await api.login.getResetPasswordToken(login,code);
        await assertCode(resetPasswordTokenResponse.status, 200);
        const token = resetPasswordTokenResponse.data.token;

        const response = await api.login.changePassword("", token);

        try {
            if (response.status === 200) {
                await loginService.changePassword();
            }
        } finally {
            await step('assert get reset password token response', async () => {
                await assertCode(response.status, 400);
                await assertEquals(response.data.message, INVALID_LOGIN_OR_PASSWORD, 'error message ');
            });
        }
    });
});
