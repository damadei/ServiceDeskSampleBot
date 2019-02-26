import * as request from 'request-promise';

export class SmsService {

    /**
     * Send SMS message
     * 
     * @param userId Id of the user
     */
    async sendSms(message: string, phone: string) {
        let result = await request.post({
            url: process.env.SMS_SERVICE_URL,
            json: {
                message: message,
                phone: phone
            }
        });
    }

}