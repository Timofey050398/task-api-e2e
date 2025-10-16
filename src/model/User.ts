// User.ts
export class User {
    public tgApiId: number;
    constructor(
        public login: string,
    public password: string,
    public email: string,
    public pin: string,
    tgApiId: string,
    public tgHash: string,
    public phoneNumber: string,
    public tgSession: string
) {
        this.tgApiId = Number(tgApiId);
    }
}