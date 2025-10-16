import "dotenv/config";
import {User} from "../model/User";

export const USER_ONE = new User(
    process.env.TEST_USER_LOGIN ?? "",
    process.env.TEST_USER_PASS ?? "",
    process.env.MAILTM_EMAIL ?? "",
    process.env.TEST_PIN ?? "",
    process.env.TG_API_ID ?? "",
    process.env.TG_API_HASH ?? "",
    process.env.TG_PHONE_NUMBER ?? "",
    process.env.TG_SESSION ?? ""
);

export const USER_TWO = new User(
    process.env.TEST_USER_LOGIN_OTHER ?? "",
    process.env.TEST_USER_PASS ?? "",
    process.env.MAILTM_EMAIL_OTHER ?? "",
    process.env.TEST_PIN ?? "",
    process.env.TG_API_ID_OTHER ?? "",
    process.env.TG_API_HASH_OTHER ?? "",
    process.env.TG_PHONE_NUMBER_OTHER ?? "",
    process.env.TG_SESSION_OTHER ?? ""
);