export class User {
    constructor(
        login,
        password,
        email,
        pin,
        tgApiId,
        tgHash,
        phoneNumber,
        tgSession
    ) {
        this.login = login;
        this.password = password;
        this.email = email;
        this.pin = pin;
        this.tgApiId = Number(tgApiId);
        this.tgHash = tgHash;
        this.phoneNumber = phoneNumber;
        this.tgSession = tgSession;
    }}