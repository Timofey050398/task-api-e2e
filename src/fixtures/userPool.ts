import { test as base } from '@playwright/test';
import * as dotenv from 'dotenv';
import { USER_ONE, USER_TWO } from '../constants/Users';
import { User } from '../model/User';
import { LoginService } from '../services/api/LoginService';
import { MailTmService } from '../services/mail/MailTmService';
import {ApiFacade} from "../api/ApiFacade";
import {BlockchainServiceFacade} from "../services/blockchain/BlockchainServiceFacade";
import {WalletService} from "../services/api/WalletService";
dotenv.config();

interface PooledUser extends User {
    busy: boolean;
}

const users: PooledUser[] = [
    { ...USER_ONE, busy: false },
    //  { ...USER_TWO, busy: false },
];

async function acquireUser(): Promise<PooledUser> {
    let user: PooledUser | undefined;

    while (!user) {
        const freeUser = users.find(u => !u.busy);
        if (freeUser) {
            freeUser.busy = true;
            user = freeUser;
        } else {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    return user;
}

function releaseUser(login: string): void {
    const user = users.find(u => u.login === login);
    if (user) user.busy = false;
}

type Fixtures = {
    loginService: LoginService;
    walletService: WalletService;
    api: ApiFacade;
    mailService: MailTmService;
    blockchain : BlockchainServiceFacade;
};

type WorkerFixtures = {
    user: PooledUser;
};

const test = base.extend<Fixtures, WorkerFixtures>({
    user: [
        async ({}, use) => {
            const user = await acquireUser();
            console.log(`→ [${process.pid}] получил ${user.login}`);

            await use(user);

            releaseUser(user.login);
            console.log(`← [${process.pid}] освободил ${user.login}`);
        },
        { scope: 'worker' },
    ],

    blockchain: async ({}, use) => {
        const blockchain = new BlockchainServiceFacade();
        await use(blockchain);
    },

    loginService: async ({ user }, use) => {
        const loginService = new LoginService(user);
        await use(loginService);
    },

    walletService: async ({ user }, use) => {
        const walletService = new WalletService(user);
        await use(walletService);
    },

    mailService: async ({ user }, use) => {
        const mailService = new MailTmService(user);
        await use(mailService);
    },

    api: async ({user}, use) => {
        const api = new ApiFacade(user);
        await use(api);
    },
});

export { test };
export { expect } from '@playwright/test';
