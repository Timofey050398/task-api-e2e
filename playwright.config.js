import { defineConfig } from '@playwright/test';

export default defineConfig({
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