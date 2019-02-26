// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { TurnContext, TokenResponse } from 'botbuilder';
import { OAuthPrompt } from 'botbuilder-dialogs';
import { SimpleGraphClient } from './ms-graph-client';
import { UserProfile } from '../model/userProfile';
import { AuthResponder } from './responder';

export class OAuthHelpers {

    public static LoginPromptName = 'LoginPrompt';

    /**
     * Displays information about the user in the bot.
     * @param {TurnContext} turnContext A TurnContext instance containing all the data needed for processing this conversation turn.
     * @param {TokenResponse} tokenResponse A response that includes a user token.
     */
    static async getMe(turnContext: TurnContext, tokenResponse: TokenResponse): Promise<UserProfile> {
        if (!turnContext) {
            throw new Error('OAuthHelpers.listMe(): `turnContext` cannot be undefined.');
        }
        if (!tokenResponse) {
            throw new Error('OAuthHelpers.listMe(): `tokenResponse` cannot be undefined.');
        }

        try {
            const client = new SimpleGraphClient(tokenResponse.token);
            let me = await client.getMe();
            me.userId = me.userPrincipalName;
            me.authToken = tokenResponse.token;
            return me;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Prompts the user to log in using the OAuth provider specified by the connection name.
     * @param {string} connectionName The connectionName from Azure when the OAuth provider is created.
     */
    static prompt(connectionName: string) {
        const loginPrompt = new OAuthPrompt(OAuthHelpers.LoginPromptName,
            {
                connectionName: connectionName,
                text: AuthResponder.auth_prompt(),
                title: AuthResponder.auth_title(),
                timeout: 30000 // User has 5 minutes to login.
            });
        return loginPrompt;
    }

    static isValid(jwtToken: string) {
        //TODO: validate the token here
        return true;
    }
}
