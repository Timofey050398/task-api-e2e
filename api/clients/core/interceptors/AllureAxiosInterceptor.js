import {attachment, Status, step} from "allure-js-commons";
import {safeJson} from "../../../../utils/safeJson";

async function attachRequest(meta, config) {
    const requestInfo = {
        url: meta.url,
        method: meta.method,
        headers: config.headers,
        body: safeJson(config.data),
    };
    await attachment("📤 Request", JSON.stringify(requestInfo, null, 2), "application/json");
}

export class AllureAxiosInterceptor {
    constructor(axiosInstance) {
        axiosInstance.interceptors.request.use((config) => {
            const method = config.method?.toUpperCase() || "REQUEST";
            const url = `${config.baseURL || ""}${config.url}`;
            const stepName = `HTTP → ${method} ${url}`;
            const startTime = Date.now();

            // Сохраняем данные для шага
            config.__allureMeta = { stepName, startTime, method, url };
            return config;
        });

        axiosInstance.interceptors.response.use(
            async (response) => {
                const { config, status, headers, data } = response;
                const meta = config.__allureMeta || {};
                const elapsed = Date.now() - meta.startTime;

                // выполняем один общий step
                return await step(`${meta.stepName} ← ${status}`, async () => {
                    // request attachment
                    await attachRequest(meta, config);
                    // response attachment
                    const responseInfo = {
                        status,
                        headers,
                        body: safeJson(data),
                        durationMs: elapsed,
                    };
                    await attachment("📥 Response", JSON.stringify(responseInfo, null, 2), "application/json");

                    return response;
                });
            },
            async (error) => {
                const { config = {}, response = {} } = error;
                const meta = config.__allureMeta || {};
                const { status, data, headers } = response;
                const elapsed = Date.now() - (meta.startTime || Date.now());

                return await step(`${meta.stepName || "HTTP ✖"} ✖ ${status || error.message}`, async (s) => {
                    await attachRequest(meta, config);

                    const errorInfo = {
                        message: error.message,
                        status,
                        headers,
                        body: safeJson(data),
                        durationMs: elapsed,
                    };
                    await attachment("❌ Error Response", JSON.stringify(errorInfo, null, 2), "application/json");

                    s.status = Status.FAILED;
                    return Promise.reject(error);
                });
            }
        );
    }
}