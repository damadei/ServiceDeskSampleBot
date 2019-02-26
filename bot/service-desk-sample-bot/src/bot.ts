import { ActivityTypes, TurnContext, ConversationState, StatePropertyAccessor, UserState, RecognizerResult, CardFactory, BotTelemetryClient } from 'botbuilder';
import { LuisRecognizer } from 'botbuilder-ai';
import { LuisRecognizerFactory } from './cognitiveServices/luisRecognizerFactory';
import { LogFactory } from './utils/logger';
import { DialogSet, DialogTurnStatus, DialogContext, ConfirmPrompt, DialogTurnResult } from 'botbuilder-dialogs';
import { GenericResponder, CancellationTerms, CancellationResponder } from './utils/responder';
import { AccountPasswordFaqDialog } from './dialogs/accountPasswordFaq';
import { QnAMakerFactory } from './cognitiveServices/qnaMakerFactory';
import { PasswordResetDialog } from './dialogs/passwordReset';
import { GoodbyeDialog } from './dialogs/goodbye';
import { UserProfile } from './model/userProfile';
import { GraphService } from './services/graph/graphService';
import { SmsService } from './services/sms/smsService';
import { WelcomeCard } from './dialogs/welcome';
import { NewSupportTicketDialog } from './dialogs/newSupportTicket';
import { AuthDialog } from './dialogs/authDialog';
import { QuerySupportTicketsDialog } from './dialogs/querySupportTickets';
import { SupportTicketServiceFactory } from './services/supportTicket/supportTicketServiceFactory';
import { Event } from './utils/events';

const DISPATCH_LUIS_CONFIG_NAME = 'ServiceDeskSampleBot_dispatch';
const ACCOUNT_PASSWORD_LUIS_CONFIG_NAME = 'ServiceDeskSampleBot_account_password';
const SUPPORT_TICKET_LUIS_CONFIG_NAME = 'ServiceDeskSampleBot_support_ticket';

// state properties
const DIALOG_STATE_PROPERTY = 'DialogState';
const USER_PROFILE = 'UserProfileState';

// dispatch intents
const L_SUPPORT_TICKET = 'l_service_desk_support_ticket';
const L_ACCOUNT_PASSWORD = 'l_service_desk_account_password';

// account password intents
const PASSWORD_EXPIRATION = 'PASSWORD_EXPIRATION';
const ACCOUNT_LOCKED = 'ACCOUNT_LOCKED';
const CHANGE_PASSWORD = 'CHANGE_PASSWORD';

// support tickets
const QUERY_SUPPORT_TICKETS = 'QUERY_SUPPORT_TICKETS';
const NEW_SUPPORT_TICKET = 'NEW_SUPPORT_TICKET';
const SUPPORT_DELAY = 'SUPPORT_DELAY';

const log = LogFactory.getLogger("ServiceDeskBot");

export class ServiceDeskBot {

    private supportTicketLuisRecognizer: LuisRecognizer;
    private accountPasswordLuisRecognizer: LuisRecognizer;
    private dispatchLuisRecognizer: LuisRecognizer;
    private dialogs: DialogSet;
    private dialogState: StatePropertyAccessor;
    private userProfileState: StatePropertyAccessor<UserProfile>;

    constructor(
        private conversationState: ConversationState,
        private userState: UserState,
        private telemetryClient: BotTelemetryClient,
        private luisRecognizerFactory: LuisRecognizerFactory,
        private qnaMakerFactory: QnAMakerFactory,
        private graphService: GraphService,
        private smsService: SmsService) {

        log.debug(`conversationState: ${conversationState}`)
        log.debug(`userState: ${userState}`)
        log.debug(`luisRecognizerFactory: ${luisRecognizerFactory}`)

        this.dispatchLuisRecognizer = luisRecognizerFactory.getLuisRecognizer(DISPATCH_LUIS_CONFIG_NAME);
        log.info(`Dispatch LUIS Recognizer created: ${this.dispatchLuisRecognizer}`);

        this.supportTicketLuisRecognizer = luisRecognizerFactory.getLuisRecognizer(SUPPORT_TICKET_LUIS_CONFIG_NAME);
        log.info(`Support Ticket LUIS Recognizer created: ${this.supportTicketLuisRecognizer}`);

        this.accountPasswordLuisRecognizer = luisRecognizerFactory.getLuisRecognizer(ACCOUNT_PASSWORD_LUIS_CONFIG_NAME);
        log.info(`Account and Password LUIS Recognizer created: ${this.accountPasswordLuisRecognizer}`);

        //state
        this.userProfileState = this.userState.createProperty(USER_PROFILE);

        // dialogs
        this.dialogState = this.conversationState.createProperty(DIALOG_STATE_PROPERTY);
        this.dialogs = new DialogSet(this.dialogState);
        this.dialogs.telemetryClient = telemetryClient;

        let accountPasswordFaqDialog = new AccountPasswordFaqDialog(
            AccountPasswordFaqDialog.Name,
            this.qnaMakerFactory);
        this.dialogs.add(accountPasswordFaqDialog);

        let passwordResetDialog = new PasswordResetDialog(
            PasswordResetDialog.Name,
            this.graphService,
            this.smsService,
            this.accountPasswordLuisRecognizer,
            this.userProfileState, this.conversationState);
        this.dialogs.add(passwordResetDialog);

        let goodbyeDialog = new GoodbyeDialog(GoodbyeDialog.Name);
        this.dialogs.add(goodbyeDialog);

        let newSupportTicketDialog = new NewSupportTicketDialog(
            NewSupportTicketDialog.Name,
            SupportTicketServiceFactory.getSupportTicketKbService(
                this.luisRecognizerFactory, this.qnaMakerFactory),
            SupportTicketServiceFactory.getSupportTicketService(),
            this.supportTicketLuisRecognizer,
            this.conversationState,
            this.userProfileState)
        this.dialogs.add(newSupportTicketDialog);

        let querySupportTicketsDialog = new QuerySupportTicketsDialog(
            QuerySupportTicketsDialog.Name,
            SupportTicketServiceFactory.getSupportTicketService(),
            this.conversationState,
            this.userProfileState);
        this.dialogs.add(querySupportTicketsDialog);

        let authDialog = new AuthDialog(
            AuthDialog.Name,
            this.conversationState,
            this.userProfileState);
        this.dialogs.add(authDialog);
    }

    /**
     * Use onTurn to handle an incoming activity, received from a user, process it, and reply as needed
     *
     * @param {TurnContext} context on turn context object.
     */
    public onTurn = async (turnContext: TurnContext) => {
        const dc = await this.dialogs.createContext(turnContext);

        let result: DialogTurnResult;

        let conversationId = turnContext.activity.conversation.id;
        let activityId = turnContext.activity.id;

        if (turnContext.activity.type === ActivityTypes.Message) {
            log.debug(`[${conversationId}][${conversationId}][${activityId}] is a message`);

            if (this.isCancellation(turnContext)) {
                log.debug(`[${conversationId}][${conversationId}][${activityId}] is cancellation`);

                this.telemetryClient.trackEvent(Event.getEvent(conversationId, activityId, Event.CANCEL));

                if (dc.activeDialog) {
                    await dc.cancelAllDialogs();
                    await turnContext.sendActivity(CancellationResponder.cancelled());
                } else {
                    await turnContext.sendActivity(CancellationResponder.nothing_to_cancel());
                }
            } else {
                let dialogTurnResult = await dc.continueDialog();

                result = await this.redirectIfNeeded(turnContext, dc, dialogTurnResult);

                if (result) {
                    log.debug(`[${conversationId}][${activityId}] has redirected`);
                } else {
                    if (!turnContext.responded && dialogTurnResult.status !== DialogTurnStatus.complete) {
                        log.debug(`[${conversationId}][${activityId}] text: ${turnContext.activity.text}`);

                        const dispatchResults = await this.dispatchLuisRecognizer.recognize(turnContext);
                        const dispatchTopIntent = LuisRecognizer.topIntent(dispatchResults);

                        log.debug(`[${conversationId}][${activityId}] dispatch top intent: ${dispatchTopIntent}`);

                        switch (dispatchTopIntent) {
                            case L_ACCOUNT_PASSWORD:
                                result = await this.handleAccountPasswordIntents(turnContext, dc);
                                break;
                            case L_SUPPORT_TICKET:
                                result = await this.handleSupportTicketIntents(turnContext, dc);
                                break;
                            default:
                                log.error(`[${conversationId}][${activityId}] unknown intent for utterance ${turnContext.activity.text}`);
                                await this.handleUnknwonIntent(turnContext, dispatchResults, dispatchTopIntent);
                        }
                    } else {
                        if (dialogTurnResult.status == DialogTurnStatus.complete
                            && (!dialogTurnResult.result || !dialogTurnResult.result.goodbye)) {
                            log.debug(`[${conversationId}][${activityId}] starting goodbye dialog`);
                            result = await dc.beginDialog(GoodbyeDialog.Name);
                        }
                    }
                }
            }
        } else if (turnContext.activity.type === ActivityTypes.ConversationUpdate &&
            turnContext.activity.recipient.id !== turnContext.activity.membersAdded[0].id) {

            this.telemetryClient.trackEvent(
                Event.getEvent(turnContext.activity.conversation.id, 
                    turnContext.activity.id, Event.CONVERSATION_STARTED));

            log.debug(`[${conversationId}][${activityId}] conversation update. Sending welcome message.`);

            const welcomeCard = CardFactory.adaptiveCard(WelcomeCard);
            await turnContext.sendActivity({ attachments: [welcomeCard] });
        } else {
            if(dc.activeDialog) {
                await dc.continueDialog();
            }
        }

        await this.conversationState.saveChanges(turnContext);
        await this.userState.saveChanges(turnContext);

        if (result) {
            return result;
        }
    }

    private async handleAccountPasswordIntents(turnContext: TurnContext, dc: DialogContext): Promise<DialogTurnResult> {
        let conversationId = turnContext.activity.conversation.id;
        let activityId = turnContext.activity.id;

        log.debug(`[${conversationId}][${activityId}] handleAccountPasswordIntents`);

        const accountPasswordResults = await this.accountPasswordLuisRecognizer.recognize(turnContext);
        const topIntent = LuisRecognizer.topIntent(accountPasswordResults, "None", 0.2);

        log.debug(`[${conversationId}][${activityId}] topIntent: ${topIntent}`);

        if (this.shouldSendToFaq(topIntent)) {
            log.debug(`[${conversationId}][${activityId}] sending to FAQ`);
            return await dc.beginDialog(AccountPasswordFaqDialog.Name, accountPasswordResults);
        } else {
            switch (topIntent) {
                case PASSWORD_EXPIRATION:
                case ACCOUNT_LOCKED:
                case CHANGE_PASSWORD:
                    log.debug(`[${conversationId}][${activityId}] starting password reset dialog.`);
                    return await dc.beginDialog(PasswordResetDialog.Name, accountPasswordResults);
                default:
                    log.debug(`[${conversationId}][${activityId}] unknown intent.`);
                    log.error(`[${conversationId}][${activityId}] Unknown intent for utterance in Account and Password LUIS ${turnContext.activity.text}`);
                    await this.handleUnknwonIntent(turnContext, accountPasswordResults, topIntent);
            }
        }

        return null;
    }

    private async handleSupportTicketIntents(turnContext: TurnContext, dc: DialogContext): Promise<DialogTurnResult> {
        let conversationId = turnContext.activity.conversation.id;
        let activityId = turnContext.activity.id;

        log.debug(`[${conversationId}][${activityId}] handleSupportTicketIntents`);

        const supportTicketResults = await this.supportTicketLuisRecognizer.recognize(turnContext);
        const topIntent = LuisRecognizer.topIntent(supportTicketResults);
        log.debug(`[${conversationId}][${activityId}] topIntent: ${topIntent}`);

        switch (topIntent) {
            case QUERY_SUPPORT_TICKETS:
                return await dc.beginDialog(QuerySupportTicketsDialog.Name, supportTicketResults);
                break;
            case NEW_SUPPORT_TICKET:
                return await dc.beginDialog(NewSupportTicketDialog.Name, supportTicketResults);
            case SUPPORT_DELAY:
                await turnContext.sendActivity(topIntent);
                break;
            default:
                log.error(`[${conversationId}][${activityId}] unknown intent for utterance in Support Ticket handler ${turnContext.activity.text}`);
                await this.handleUnknwonIntent(turnContext, supportTicketResults, topIntent);
                break;
        }

        return null;
    }

    private async handleUnknwonIntent(context: TurnContext,
        dispatchResults: RecognizerResult, dispatchTopIntent: string) {
        await context.sendActivity(GenericResponder.could_not_understand());
    }

    private async redirectIfNeeded(turnContext: TurnContext, dc: DialogContext, dialogTurnResult: any) {
        let conversationId = turnContext.activity.conversation.id;
        let activityId = turnContext.activity.id;

        //check if we need to redirect to another dialog
        if (dialogTurnResult.status == DialogTurnStatus.complete
            && dialogTurnResult.result && dialogTurnResult.result.redirect === true) {

            log.info(`[${conversationId}][${activityId}] redirecting to ${dialogTurnResult.result.to}`);
            return await dc.beginDialog(dialogTurnResult.result.to);
        } else {
            return null;
        }
    }

    private shouldSendToFaq(intent: string): boolean {
        return intent.startsWith("INFO_");
    }

    private isCancellation(turnContext: TurnContext): boolean {
        let regexp = CancellationTerms.cancel_regexp();
        let utterance = turnContext.activity.text;

        if (utterance) {
            utterance = utterance.toLowerCase();
            return regexp.test(utterance);
        } else {
            return false;
        }
    }

}

