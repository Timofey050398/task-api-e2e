import {BaseClient} from "./core/BaseClient";

export class CashClient extends BaseClient {
    constructor(user, processErrors = true) {
        super(user, processErrors);
    }

    async cancelCashInvoice(orderId) {
        return await this.post(
            "/order/cancel",
            {orderID: orderId, type : "cashInvoice"}
        );
    }

    async createCashInvoice(
        accountId,
        amount,
        cityId,
        client ,
        comment,
        companion,
        countyId ,
        currencyId,
        dateTimestamp,
        multiplyOf,
        officeId
    ){
        return await this.post(
            "/cash/invoice",
            {
                accountID: accountId,
                amount: amount,
                cityID: cityId,
                client: {
                    Name : client.name,
                    Surname: client.surname,
                    Patronymic: client.patronymic
                },
                comment: comment,
                companion: {
                    Name : companion.name,
                    Surname: companion.surname,
                    Patronymic: companion.patronymic
                },
                countryID : countyId,
                currencyID : currencyId,
                date : dateTimestamp,
                multiplyOf : multiplyOf,
                officeID : officeId,
            }
        );
    }

    async getCashOffices(cityId, countyId) {
        return await this.post(
            "/cash/office/getall",
            {cityID: cityId, countyID: countyId},
        )
    }

    async getInvoiceSlots(dayTimestamp, officeId) {
        return await  this.post(
            "cash/office/fetch-slots",
            {Day: dayTimestamp, OfficeID: officeId, TimeZone: "Europe/Moscow"}
        );
    }
}