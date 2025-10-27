import {AxiosError, AxiosResponse} from "axios";


export async function getApiError<T>(
    fn: () => Promise<T>
): Promise<AxiosResponse> {
    try {
        await fn();
        throw new Error("Ожидали ошибку, а был успех");
    } catch (err: unknown) {
        if (err instanceof AxiosError) {
            if (err.response) return err.response;
            throw new Error("AxiosError без response");
        }
        throw err; // Не axios — пробрасываем дальше
    }
}