import colors from 'colors';

/**
 * Логгер HTTP-запросов и ответов.
 * Можно подключить к любому axios-инстансу.
 *
 * @example
 *   const client = axios.create();
 *   new LogInterceptor(client);
 */
export class LogInterceptor {
    constructor(axiosInstance) {
        if (!axiosInstance || !axiosInstance.interceptors) {
            throw new Error('LogInterceptor requires a valid axios instance');
        }

        axiosInstance.interceptors.request.use((config) => {
            const { method, baseURL = '', url, data } = config;
            console.log(colors.cyan(`[HTTP] → ${method.toUpperCase()} ${baseURL}${url}`));

            if (data) {
                console.log(colors.gray(`[HTTP] Payload: ${JSON.stringify(data, null, 2)}`));
            }

            config.metadata = { startTime: new Date() };
            return config;
        });

        axiosInstance.interceptors.response.use((response) => {
            const { status, config, data } = response;
            const color = status < 400 ? colors.green : colors.red;
            const duration = this._getDuration(config);

            console.log(color(`[HTTP] ← ${status} ${config.method.toUpperCase()} ${config.url} (${duration}ms)`));
            if (data) {
                console.log(colors.gray(`[HTTP] Response: ${JSON.stringify(data, null, 2)}`));
            }

            return response;
        }, (error) => {
            const { config } = error;
            const duration = this._getDuration(config);
            console.log(colors.red(`[HTTP] ✖ ${config?.method?.toUpperCase() || ''} ${config?.url || ''} failed (${duration}ms)`));
            console.error(colors.red(`[HTTP] Error: ${error.message}`));
            throw error;
        });
    }

    _getDuration(config) {
        if (!config?.metadata?.startTime) return '?';
        return new Date() - config.metadata.startTime;
    }
}