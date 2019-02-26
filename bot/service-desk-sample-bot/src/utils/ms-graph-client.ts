import { Client } from '@microsoft/microsoft-graph-client';

/**
 * This class is a wrapper for the Microsoft Graph API.
 * See: https://developer.microsoft.com/en-us/graph for more information.
 */
export class SimpleGraphClient {

    private graphClient: Client;

    constructor(private token: string) {
        if (!token || !token.trim()) {
            throw new Error('SimpleGraphClient: Invalid token received.');
        }

        this.token = token;

        // Get an Authenticated Microsoft Graph client using the token issued to the user.
        this.graphClient = Client.init({
            authProvider: (done) => {
                done(null, this.token);
            }
        });
    }

    /**
     * Collects information about the user in the bot.
     */
    async getMe() {
        return await this.graphClient.api('/me').get();
    }

}