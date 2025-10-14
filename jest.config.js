module.exports = {
    testEnvironment: 'node',
    testMatch: ['**/tests/**/*.test.js'],
    reporters: [
        'default',
        [
            'jest-allure',
            {
                resultsDir: 'allure-results'
            }
        ]
    ]
};