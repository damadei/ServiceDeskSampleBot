// greeting.js defines the greeting dialog
import { ComponentDialog, PromptValidatorContext, TextPrompt, WaterfallDialog, WaterfallStepContext, DialogTurnStatus } from 'botbuilder-dialogs';
import { LogFactory } from '../../utils/logger';
import { RecognizerResult, StatePropertyAccessor, TurnContext, ConversationState } from 'botbuilder';
import { LuisRecognizer } from 'botbuilder-ai';
import { UserProfile } from '../../model/userProfile';
import { UserIdPrompt, MagicCodeValidationPrompt } from './passwordResetPrompts';
import { PasswordReset } from '../../model/passwordReset';
import { PasswordResetResponder } from '../../utils/responder';
import { GraphService } from '../../services/graph/graphService';
import { SmsService } from '../../services/sms/smsService';
import { generate as generateRandomString } from 'randomstring';
import { BaseComponentDialog } from '../utils/BaseComponentDialog';
import { Event } from '../../utils/events';

const log = LogFactory.getLogger("PasswordResetDialog");

const USER_ID_ENTITY = 'user_id';
const PASSWORD_RESET_STATE = 'PasswordResetState';

/**
 * Password Reset Dialog implementation
 * 
 * @param {String} dialogId unique identifier for this dialog instance
 */
export class PasswordResetDialog extends BaseComponentDialog {

    public static readonly Name: string = "PasswordResetDialog";

    private passwordResetState: StatePropertyAccessor<PasswordReset>;

    constructor(dialogId: string,
        private graphService: GraphService,
        private smsService: SmsService,
        private accountPasswordLuisRecognizer: LuisRecognizer,
        private userProfileState: StatePropertyAccessor<UserProfile>,
        private conversationState: ConversationState) {

        super(dialogId);

        // validate what was passed in
        if (!dialogId) { throw Error('Missing parameter.  dialogId is required'); }

        this.passwordResetState = conversationState.createProperty(PASSWORD_RESET_STATE);

        this.addDialog(new WaterfallDialog('start', [
            this.checkUserIdPassedAsEntity.bind(this),
            this.promptForUserId.bind(this),
            this.validateUserId.bind(this),
            this.storeUserId.bind(this),
            this.authenticateUser.bind(this),
            this.genPasswordAndSend.bind(this)
        ]));

        this.addDialog(new UserIdPrompt(UserIdPrompt.Name));
        this.addDialog(new MagicCodeValidationPrompt(MagicCodeValidationPrompt.Name, this.passwordResetState));
    }

    /**
     * Initialize our state.  See if the WaterfallDialog has state pass to it
     * If not, then just new up an empty UserProfile object
     *
     * @param {WaterfallStepContext} step contextual information for the current step being executed
     */
    private checkUserIdPassedAsEntity = async (step: WaterfallStepContext<RecognizerResult>) => {
        this.telemetryClient.trackEvent(Event.getEventFromContext(step.context, Event.PASSWORD_RESET_START));

        let recognizerResults: RecognizerResult = step.options;

        if (!recognizerResults || !recognizerResults.entities) {
            const text = step.context.activity.text;
            recognizerResults = await this.accountPasswordLuisRecognizer.recognize(step.context);
        }

        let userProfile = await this.userProfileState.get(step.context);

        if (recognizerResults.entities.user_id) {
            let userId = recognizerResults.entities.user_id;
            if (userId) {
                userProfile.userId = userId;
                await this.userProfileState.set(step.context, userProfile);
                return step.next(userId);
            }
        } else {
            if (userProfile && userProfile.userId) {
                return step.next(userProfile.userId);
            }
        }

        return step.next();
    }

    async promptForUserId(step: WaterfallStepContext) {
        if (!step.result) {
            return await step.prompt(UserIdPrompt.Name, PasswordResetResponder.user_id_prompt());
        } else {
            return step.next(step.result);
        }
    }

    async validateUserId(step: WaterfallStepContext) {
        let userId = step.result;
        let userProfile = await this.graphService.getUserById(userId);

        if (userProfile) {
            if (userProfile.mobilePhone) {
                return step.next(userProfile);
            } else { //TODO: add a check if mobile has country code
                await step.context.sendActivity(PasswordResetResponder.mobile_not_found());
                return await step.endDialog();
            }
        } else {
            await step.context.sendActivity(PasswordResetResponder.user_id_not_found());
            if(!this.findDialog(PasswordResetDialog.Name)) {
                this.addDialog(this);
            }
            return await step.replaceDialog(PasswordResetDialog.Name);
        }
    }

    async storeUserId(step: WaterfallStepContext) {
        await this.userProfileState.set(step.context, step.result);
        return step.next(step.result);
    }

    async authenticateUser(step: WaterfallStepContext) {
        let userProfile: UserProfile = step.result;

        await step.context.sendActivity(PasswordResetResponder.inform_auth_prompt(userProfile.mobilePhone));

        let magicCode = this.getRandomCode(1000, 9999);

        const state = await this.passwordResetState.get(step.context, new PasswordReset());
        state.magicCode = magicCode;
        await this.passwordResetState.set(step.context, state);

        this.smsService.sendSms(PasswordResetResponder.sms_message(magicCode), userProfile.mobilePhone);

        log.info(`Magic code: ${magicCode} `); //TODO: remove, added just for testing with mocks
        return await step.prompt(MagicCodeValidationPrompt.Name, PasswordResetResponder.magic_code_prompt());
    }

    async genPasswordAndSend(step: WaterfallStepContext) {
        let password = this.genPassword();
        log.info(`Password: ${password} `); //TODO: remove, added just for testing with mocks

        let userProfile = await this.userProfileState.get(step.context, new UserProfile());

        try {
            await this.graphService.changeUserPassword(userProfile, password);
            await step.context.sendActivity(PasswordResetResponder.password_sent());
            this.smsService.sendSms(PasswordResetResponder.sms_message_password(password), userProfile.mobilePhone);
        } catch(error) {
            this.error(log, step.context, "Error updating password", error);
            await step.context.sendActivity(PasswordResetResponder.error_changing_password());    
        }

        return step.endDialog();
    }

    getRandomCode(min: number, max: number) {
        return Math.trunc(Math.random() * (max - min) + min);
    }

    genPassword() {
        return generateRandomString({
            length: 6,
            charset: 'alphanumeric'
        }) +
        generateRandomString({
            length: 2,
            charset: 'numeric'
        });
    }
}

