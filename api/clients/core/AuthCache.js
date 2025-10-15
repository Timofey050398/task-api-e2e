export const AuthCache = {
    cookies: '',
    sseToken: null,

    set({ cookies = '', sseToken = null } = {}) {
        this.cookies = cookies;
        this.sseToken = sseToken;
    },

    clear() {
        this.cookies = '';
        this.sseToken = null;
    }
};
