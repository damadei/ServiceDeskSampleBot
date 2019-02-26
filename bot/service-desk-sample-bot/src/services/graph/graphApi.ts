import * as request from 'request-promise';
import { UserProfile } from '../../model/userProfile';

export class GraphApi {

    private authResult;
    private graphUrl: string = process.env.PWD_RESET_AAD_URL;
    private tenantId: string = process.env.PWD_RESET_TENANT_ID;
    private apiVersion: string = process.env.PWD_RESET_GRAPH_API_VERSION;

    constructor() {
    }

    async changePassword(userProfile: UserProfile, newPassword: string) {
        let token = `Bearer ${this.authResult.access_token}`;
        let url = `${this.getBaseGraphURL()}/users/${userProfile.objectId}?api-version=${this.apiVersion}`;

        let result = await request.patch({
            url: url,
            headers: { 'Authorization': token, 'Content-Type': 'application/json' },
            json: {
                "passwordProfile": {
                    "password": newPassword,
                    "forceChangePasswordNextLogin": true 
                }
            }
        });
    }

    
    async getUsers(url: string, userId: string) {
        let token = `Bearer ${this.authResult.access_token}`;

        let result = await request.get({
            url: url,
            headers: { 'Authorization': token}
        });

        return this.firstOrNull(JSON.parse(result), userId);
    }

    async getUserByMailNickname(mailNickname: string): Promise<UserProfile> {
        let url = `${this.getBaseGraphURL()}/users?$filter=mailNickname eq '${mailNickname}'&api-version=${this.apiVersion}`;

        try {
            return await this.getUsers(url, mailNickname);
        } catch(error) {
            console.log(`Error getting user by mail name: ${error}`);
            console.log(error);
            throw error;
        }
    }

    async getUserByMail(mail: string): Promise<UserProfile> {
        let url = `${this.getBaseGraphURL()}/users?$filter=mail eq '${mail}'`;
    
        try {
            return await this.getUsers(url, mail);
        } catch(error) {
            console.log(`Error getting user by mail: ${error}`);
            console.log(error);
            throw error;
        }
    }

    async getUserByPrincipalName(userPrincipalName: string): Promise<UserProfile> {
        let url =  `${this.getBaseGraphURL()}/users?$filter=userPrincipalName eq '${userPrincipalName}'&api-version=${this.apiVersion}`;

        try {
            return await this.getUsers(url, userPrincipalName);
        } catch(error) {
            console.log(`Error getting user by user principal name: ${error}`);
            console.log(error);
            throw error;
        }
    }

    firstOrNull(jsonResult, userId: string): UserProfile {
        if(jsonResult.value.length === 0) {
            return null;
        } else {
            let user = jsonResult.value[0];

            let profile = new UserProfile(); 
            profile.userId = userId
            profile.objectId = user.objectId;
            profile.givenName = user.givenName;
            profile.surname = user.surname;
            profile.displayName = user.displayName;
            profile.mail = user.mail;
            profile.mobilePhone = user.mobile;
            profile.usageLocation = user.usageLocation;
            profile.userPrincipalName = user.userPrincipalName;

            return profile;
        }
    }

    getBaseGraphURL(): string {
        return `${this.graphUrl}/${this.tenantId}`;
    }

    async auth() {
        let url = `https://login.microsoftonline.com/${this.tenantId}/oauth2/token`;
    
        let result = await request.post({
            url: url,
            form: {
                grant_type: 'client_credentials',
                client_id: process.env.PWD_RESET_APP_ID,
                client_secret: process.env.PWD_RESET_APP_SECRET,
                resource: 'https://graph.windows.net'
            }
        });

        this.authResult = JSON.parse(result);
    }
}