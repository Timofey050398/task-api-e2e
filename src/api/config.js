export const config = {
    baseUrl: 'https://srv.aifory.pro/lk/v1',
    headers: {
        'accept': '*/*',
        'content-type': 'application/json',
        'locale': 'ru',
    },
    timeout: 10_000,
    auth: {
        token: process.env.API_TOKEN,
    },
};