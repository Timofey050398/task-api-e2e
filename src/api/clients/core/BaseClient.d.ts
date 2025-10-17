import { AxiosInstance } from 'axios';
import {LoginService} from "../../../services/api/LoginService";

export class BaseClient {
    client: AxiosInstance;

    constructor(loginService?: LoginService, processErrors? :boolean, baseUrl?: string) {};

    initAuthIfNeeded(): Promise<void>;
    setCookies(cookieString: string): void;
    setHeader(name: string, value: string): void;

    get(url: string, params?: any, options?: any): Promise<any>;
    post(url: string, body?: any, options?: any): Promise<any>;
    put(url: string, body?: any, options?: any): Promise<any>;
    delete(url: string, options?: any): Promise<any>;
}