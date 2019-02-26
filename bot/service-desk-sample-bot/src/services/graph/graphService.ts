import { GraphApi } from "./graphApi";
import { UserProfile } from "../../model/userProfile";

export class GraphService {

    /**
     * Validate if the userId is valid
     * 
     * @param userId Id of the user
     */
    async getUserById(userId: string): Promise<UserProfile> {

        let graphApi = new GraphApi();
        await graphApi.auth();

        let user = await graphApi.getUserByPrincipalName(userId);

        if(!user) {
            user = await graphApi.getUserByMail(userId);
        }

        return user;
    }

    /**
     * Change a user password
     * 
     * @param userProfile Profile of the logged user
     * @param newPassword New password
     */
    async changeUserPassword(userProfile: UserProfile, newPassword: string) {
        let graphApi = new GraphApi();
        await graphApi.auth();

        await graphApi.changePassword(userProfile, newPassword);
    }

}