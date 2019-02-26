// greeting.js defines the greeting dialog
import { ComponentDialog, WaterfallDialog, WaterfallStepContext, DialogTurnStatus, ConfirmPrompt } from 'botbuilder-dialogs';
import { LogFactory } from '../../utils/logger';
import { StatePropertyAccessor, ConversationState } from 'botbuilder';
import { UserProfile } from '../../model/userProfile';
import { OAuthHelpers } from '../../utils/oauth-helpers';
import { AuthResponder } from '../../utils/responder';
import { BaseComponentDialog } from '../utils/BaseComponentDialog';
import { TelemetryClient } from 'applicationinsights';
import { Event } from '../../utils/events';

const log = LogFactory.getLogger("PasswordResetDialog");

const CONNECTION_SETTING_NAME = process.env.OAUTH_CONFIG_NAME;

const ANSWERS = 3;

/**
 * New Support Ticket Dialog implementation
 * 
 * @param {String} dialogId unique identifier for this dialog instance
 */
export class AuthDialog extends BaseComponentDialog {

    public static readonly Name: string = "AuthDialog";

    constructor(dialogId: string,
        private conversationState: ConversationState,
        private userProfileState: StatePropertyAccessor<UserProfile>) {

        super(dialogId);

        if (!dialogId) { throw Error('Missing parameter.  dialogId is required'); }

        // Logs in the user and calls proceeding dialogs, if login is successful.
        this.addDialog(new WaterfallDialog('start', [
            this.promptStep.bind(this),
            this.processStep.bind(this)
        ]));

        this.addDialog(OAuthHelpers.prompt(CONNECTION_SETTING_NAME));
    }

   /**
     * WaterfallDialogStep for storing commands and beginning the OAuthPrompt.
     * Saves the user's message as the command to execute if the message is not
     * a magic code.
     * @param {WaterfallStepContext} step WaterfallStepContext
     */
    async promptStep(step: WaterfallStepContext) {
        this.telemetryClient.trackEvent(Event.getEventFromContext(step.context, Event.LOGIN_START));
        await this.conversationState.saveChanges(step.context);
        return await step.beginDialog(OAuthHelpers.LoginPromptName);
    }

    /**
     * WaterfallDialogStep to process the command sent by the user.
     * @param {WaterfallStepContext} step WaterfallStepContext
     */
    async processStep(step: WaterfallStepContext) {
        const tokenResponse = step.result;
        let authSuccess = false;

        if (tokenResponse !== undefined) {
            //TODO: add code to validate the token
            let me = await OAuthHelpers.getMe(step.context, tokenResponse);
            await this.userProfileState.set(step.context, me);
            await step.context.sendActivity(AuthResponder.hello_auth_user(me.displayName));
            authSuccess = true;
            this.telemetryClient.trackEvent(Event.getEventFromContext(step.context, Event.LOGIN_SUCCESS));
        } else {
            await step.context.sendActivity(`We couldn't log you in. Please try again later.`);
            authSuccess = false;
            this.telemetryClient.trackEvent(Event.getEventFromContext(step.context, Event.LOGIN_FAILURE));
        }

        return await step.endDialog(authSuccess);
    };

}