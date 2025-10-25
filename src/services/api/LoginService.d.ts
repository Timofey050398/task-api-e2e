import { User } from '../../model/User';
import { BaseClient } from '../../api/clients/core/BaseClient';

export interface LoginResult {
    cookies: string | undefined;
    sseToken: string | null;
    client: BaseClient;
}

export class LoginService {
    constructor(user?: User);

    user: User;

    loginClient: any;

    baseClient: BaseClient;

    mailService: any;

    pin: string;

    //Логин пользователем
    login(): Promise<LoginResult>;

    //Поменять пароль
    changePassword(
        newPassword?: string,
    ): Promise<void>;
}