import { defineConfig } from '@playwright/test';

export default defineConfig({
    timeout: 0,
    testDir: './src/tests',
    reporter: [
        ['list'],
        [
            'allure-playwright',
            {
                detail: false,
                suiteTitle: true,
            }
        ]
    ],
    use: {
        headless: true,
        screenshot: 'only-on-failure',
        video: 'retain-on-failure'
    },
});