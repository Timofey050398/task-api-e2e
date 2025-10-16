/**
 * Интерцептор для автоматического повторения запросов при временных сетевых сбоях.
 * Работает с любым axios-инстансом.
 *
 * @example
 *   const client = axios.create();
 *   new RetryInterceptor(client, { maxRetries: 3, baseDelay: 500 });
 */
export class RetryInterceptor {
    constructor(axiosInstance, options = {}) {
        if (!axiosInstance || !axiosInstance.interceptors) {
            throw new Error("RetryInterceptor requires a valid axios instance");
        }

        const {
            maxRetries = 3,
            baseDelay = 500,
            retryOn = ["ECONNRESET", "ETIMEDOUT", "EAI_AGAIN"],
            retryMessages = ["socket hang up", "Network Error"],
            retryStatusCodes = [500, 502, 503, 504],
        } = options;

        axiosInstance.interceptors.response.use(
            (response) => response,
            async (error) => {
                const config = error.config;
                if (!config) throw error;

                config.__retryCount = config.__retryCount || 0;

                const code = error.code || "";
                const msg = error.message || "";
                const status = error.response?.status;

                const shouldRetry =
                    retryOn.includes(code) ||
                    retryMessages.some((m) => msg.includes(m)) ||
                    (status && retryStatusCodes.includes(status));

                if (!shouldRetry || config.__retryCount >= maxRetries) {
                    console.warn(
                        `[Retry] ❌ ${config.method?.toUpperCase()} ${config.url} failed after ${config.__retryCount} retries: ${msg}`
                    );
                    throw error;
                }

                config.__retryCount += 1;
                const delay = baseDelay * 2 ** (config.__retryCount - 1);

                console.warn(
                    `[Retry] ⚠️ ${config.method?.toUpperCase()} ${config.url} — attempt ${config.__retryCount}/${maxRetries} after ${delay}ms`
                );

                await new Promise((resolve) => setTimeout(resolve, delay));
                return axiosInstance(config);
            }
        );
    }
}