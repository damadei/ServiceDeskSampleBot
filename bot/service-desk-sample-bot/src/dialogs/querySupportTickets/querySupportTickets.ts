import { ComponentDialog, PromptValidatorContext, TextPrompt, WaterfallDialog, WaterfallStepContext, DialogTurnStatus, ConfirmPrompt } from 'botbuilder-dialogs';
import { LogFactory } from '../../utils/logger';
import { RecognizerResult, StatePropertyAccessor, TurnContext, ConversationState, MessageFactory, CardFactory, ActionTypes, ActivityTypes, Attachment, Activity } from 'botbuilder';
import { UserProfile } from '../../model/userProfile';
import { SupportTicketService } from '../../services/supportTicket/supportTicketService';
import { AuthDialog } from '../authDialog';
import { OAuthHelpers } from '../../utils/oauth-helpers';
import { LanguageUtils } from '../../utils/languageUtils';
import { SupportTicketResponder } from '../../utils/responder';
import * as TicketCard from './resources/ticket-card.json';
import { SupportTicket } from '../../model/supportTicket';
import { Event } from '../../utils/events';

const log = LogFactory.getLogger("QuerySupportTicketsDialog");

const STATUS_OPEN = 0;
const QUERY_SUPPORT_TICKET_STATE_PROPERTY = 'querySupportTicketsState';

/**
 * New Support Ticket Dialog implementation
 * 
 * @param {String} dialogId unique identifier for this dialog instance
 */
export class QuerySupportTicketsDialog extends ComponentDialog {

    public static readonly Name: string = "QuerySupportTicketsDialog";
    private querySupportTicketsState: StatePropertyAccessor;

    constructor(dialogId: string,
        private supportTicketService: SupportTicketService,
        private conversationState: ConversationState,
        private userProfileState: StatePropertyAccessor<UserProfile>) {

        super(dialogId);

        if (!dialogId) { throw Error('Missing parameter.  dialogId is required'); }

        this.querySupportTicketsState = this.conversationState.createProperty(QUERY_SUPPORT_TICKET_STATE_PROPERTY);

        this.addDialog(new WaterfallDialog('start', [
            this.authIfNeeded.bind(this),
            this.checkTicketIdEntity.bind(this),
            this.querySupportTickets.bind(this)
        ]));

        this.addDialog(new AuthDialog(AuthDialog.Name, this.conversationState, this.userProfileState));
    }

    private authIfNeeded = async (step: WaterfallStepContext<RecognizerResult>) => {
        this.telemetryClient.trackEvent(Event.getEventFromContext(step.context, Event.QUERY_TICKETS));

        let recognizerResults: RecognizerResult = step.options;

        if (recognizerResults) {
            await this.querySupportTicketsState.set(step.context, {recognizerResults: recognizerResults});
        }

        let userProfile = await this.userProfileState.get(step.context);

        if(!userProfile || !userProfile.authToken || !OAuthHelpers.isValid(userProfile.authToken)) {
            return await step.beginDialog(AuthDialog.Name);
        }

        return step.next();
    }

    /**
     *
     * @param {WaterfallStepContext} step contextual information for the current step being executed
     */
    private checkTicketIdEntity = async (step: WaterfallStepContext<RecognizerResult>) => {
        let state = await this.querySupportTicketsState.get(step.context);

        let recognizerResults: RecognizerResult;

        if(state.recognizerResults) {
            recognizerResults = state.recognizerResults;
        }

        let result = {text: null, ticketId: null};
        result.text = recognizerResults.text;

        if (recognizerResults.entities.ticket_id) {
            result.ticketId = recognizerResults.entities.ticket_id;
        } 

        return step.next(result);
    }

    /**
     * @param {WaterfallStepContext} step contextual information for the current step being executed
     */
    private querySupportTickets = async (step: WaterfallStepContext<RecognizerResult>) => {
        let result = step.result;

        let queryText = result.text;
        let ticketId = result.ticketId;

        let userProfile: UserProfile = await this.userProfileState.get(step.context);

        if(ticketId) {
            let supportTicket = await this.supportTicketService.getTicketByIdAndUser(userProfile.userPrincipalName, ticketId);
            if(supportTicket == null) {
                await step.context.sendActivity(SupportTicketResponder.no_ticket_found_with_id(ticketId));
            }
        } else if(LanguageUtils.isSingular(queryText)) {
            let supportTicket = await this.supportTicketService.getLastTicketByUser(userProfile.userPrincipalName);
            if(supportTicket == null) {
                await step.context.sendActivity(SupportTicketResponder.no_last_ticket_found());
            } else {
                await step.context.sendActivity(this.createTicketCardsCarrousel([supportTicket]));
            }
        } else {
            let supportTickets = await this.supportTicketService.queryTicketsByStatusAndUser(userProfile.userPrincipalName, STATUS_OPEN);
            if(supportTickets == null || supportTickets.length == 0) {
                await step.context.sendActivity(SupportTicketResponder.no_last_open_tickets_found());
            } else {
                await step.context.sendActivity(this.createTicketCardsCarrousel(supportTickets));
            }
        }

        return step.endDialog();
    }

    private createTicketCardsCarrousel(tickets: SupportTicket[]): Partial<Activity> {
        let attachments: Attachment[] = [];

        for (let i: number = 0; i < tickets.length; i++) {
            let ticket = tickets[i];
            attachments.push(this.getTicketCard(ticket));
        }

        return MessageFactory.carousel(attachments);
    }

    private getTicketCard(ticket: SupportTicket): Attachment {
        let json = JSON.parse(JSON.stringify(TicketCard));

        json.body[0].items[0].text = SupportTicketResponder.ticket_card_ticket_id(ticket.id);
        json.body[0].items[1].columns[0].items[0].text = SupportTicketResponder.ticket_card_creator(ticket.userId);
        json.body[0].items[1].columns[0].items[1].text = SupportTicketResponder.ticket_card_createdat(ticket.openDate);
        json.body[1].items[0].text = ticket.description;
        json.body[1].items[1].facts[0].value = SupportTicketResponder.ticket_card_status(ticket.status);
        json.body[1].items[1].facts[1].title = SupportTicketResponder.ticket_card_lastupdate_title();
        json.body[1].items[1].facts[1].value = SupportTicketResponder.ticket_card_lastupdate(ticket.lastUpdate);

        return CardFactory.adaptiveCard(json);
    }
}