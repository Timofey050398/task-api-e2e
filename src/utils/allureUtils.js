import { step } from "allure-js-commons";
import { expect } from "@playwright/test";

/**
 * Универсальное сравнение с шагом в Allure + единый аттачмент при падении
 */
export async function assertEquals(actual, expected, subject = '', message) {
    const msg = message ?? `Assert that ${subject}equals ${expected}`;
    await step(msg, async () => {
        try {
            expect(actual).toBe(expected);
        } catch (err) {
            throw err;
        }
    });
}

/**
 * Сравнивает два числа с учётом плавающей погрешности (floating-point tolerance).
 *
 * @param {number} actual - полученное значение
 * @param {number} expected - ожидаемое значение
 * @param {number} [tolerance=1e-8] - допустимая погрешность (по умолчанию ~8 знаков точности)
 */
export async function assertNumberEquals(actual, expected, tolerance = 1e-8) {
    const diff = Math.abs(Number(actual) - Number(expected));
    await assertEquals(diff <= tolerance, true);
}

/**
 * Упрощённая проверка HTTP-кода
 */
export async function assertCode(actual, expected) {
    await assertEquals(actual, expected, 'HTTP status ');
}

export async function assertExist(actual, message) {
    const msg = message ?? 'Assert that params value exists';
    await step(msg, async () => {
        expect(actual).toBeDefined();
        expect(actual).not.toBeNull();
    });
    return actual;
}