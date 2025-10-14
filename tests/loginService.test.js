import { LoginService } from "../api/services/loginService";
import { expect, test } from "@playwright/test";
import { AuthCache } from "../api/utils/AuthCache";

test.describe('LoginService', () => {
    test('should successfully login and set cookies/token', async ({}, testInfo) => {
        test.setTimeout(60000); // ✅ Правильный способ задать таймаут (60 секунд)

        const service = new LoginService();
        const result = await service.login();

        // Проверяем структуру
        expect(result).toHaveProperty('cookies');
        expect(result).toHaveProperty('sseToken');
        expect(result).toHaveProperty('client');

        // Проверяем, что токен и куки сохранились в AuthCache
        expect(AuthCache.cookies).toBe(result.cookies);
        expect(AuthCache.sseToken).toBe(result.sseToken);

        console.log('✅ LoginService login() completed successfully.');
        console.log('Cookies:', result.cookies);
        console.log('SSE token:', result.sseToken);
    });
});