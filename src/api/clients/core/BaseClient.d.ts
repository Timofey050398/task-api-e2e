import { AxiosInstance } from 'axios';
import {User} from "../../../model/User";

export class BaseClient {
    client: AxiosInstance;

    constructor(user?: User, processErrors?: boolean, baseUrl?: string);

    initAuthIfNeeded(): Promise<void>;
    setCookies(cookieString: string): void;
    setHeader(name: string, value: string): void;

    get(url: string, params?: any, options?: any): Promise<any>;
    post(url: string, body?: any, options?: any): Promise<any>;
    put(url: string, body?: any, options?: any): Promise<any>;
    delete(url: string, options?: any): Promise<any>;
}