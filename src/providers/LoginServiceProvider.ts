import { AsyncLocalStorage } from 'node:async_hooks';
import { LoginService } from '../services/api/LoginService.js';
import type { User } from '../model/User.js';

class LoginServiceProvider {
    private readonly storage = new AsyncLocalStorage<LoginService>();

    runWithService(user: User, fn: () => Promise<void>) {
        const service = new LoginService(user);
        return this.storage.run(service, fn);
    }

    get(): LoginService {
        const instance = this.storage.getStore();
        if (!instance) {
            throw new Error('[LoginServiceProvider] Attempt to access outside of test context');
        }
        return instance;
    }
}

export const loginServiceProvider = new LoginServiceProvider();