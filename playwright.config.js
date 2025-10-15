import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './tests',
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
    workers: 1,
});