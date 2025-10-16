export function safeJson(value) {
    if (!value) return value;
    if (typeof value === "string") {
        try {
            return JSON.parse(value);
        } catch {
            return value; // не JSON, оставляем как есть
        }
    }
    return value;
}