import { WaterfallDialog, WaterfallStepContext, ConfirmPrompt } from 'botbuilder-dialogs';
import { LogFactory } from '../../utils/logger';
import { RecognizerResult, StatePropertyAccessor, TurnContext, ConversationState, MessageFactory, CardFactory, ActionTypes, ActivityTypes, Attachment } from 'botbuilder';
import { LuisRecognizer } from 'botbuilder-ai';
import { UserProfile } from '../../model/userProfile';
import { ProblemStatementPrompt } from './problemStatementPrompt';
import { SupportTicketResponder } from '../../utils/responder';
import * as KbCard from './resources/kb-card.json';
import { SupportKbService, Answer } from '../../services/supportTicket/supportKbService';
import { GlobalConfig } from '../../utils/globalConfig';
import { SupportTicketService } from '../../services/supportTicket/supportTicketService';
import { AuthDialog } from '../authDialog';
import { OAuthHelpers } from '../../utils/oauth-helpers';
import { BaseComponentDialog } from '../utils/BaseComponentDialog';
import { TelemetryClient } from 'applicationinsights';
import { Event } from '../../utils/events';

const log = LogFactory.getLogger("PasswordResetDialog");

const CONTINUE_OPENING_TICKET = 'continueOpeningTicketPrompt';
const SUPPORT_TICKET_STATE_PROPERTY = 'newSupportTicketState';

const ANSWERS = 3;

/**
 * New Support Ticket Dialog implementation
 * 
 * @param {String} dialogId unique identifier for this dialog instance
 */
export class NewSupportTicketDialog extends BaseComponentDialog {

    public static readonly Name: string = "NewSupportTicketDialog";

    private newSupportTicketState: StatePropertyAccessor;

    constructor(dialogId: string,
        private supportKbService: SupportKbService,
        private supportTicketService: SupportTicketService,
        private supportTicketRecognizer: LuisRecognizer,
        private conversationState: ConversationState,
        private userProfileState: StatePropertyAccessor<UserProfile>) {

        super(dialogId);

        if (!dialogId) { throw Error('Missing parameter.  dialogId is required'); }

        this.addDialog(new WaterfallDialog('start', [
            this.authIfNeeded.bind(this),
            this.checkProblemStatementPassedAsEntity.bind(this),
            this.promptForProblemStatement.bind(this),
            this.searchForSolutions.bind(this),
            this.checkIfContinueOpeningTicket.bind(this),
        ]));

        this.addDialog(new ProblemStatementPrompt(ProblemStatementPrompt.Name));
        this.addDialog(new ConfirmPrompt(CONTINUE_OPENING_TICKET, null, GlobalConfig.locale));

        this.newSupportTicketState = this.conversationState.createProperty(SUPPORT_TICKET_STATE_PROPERTY);

        this.addDialog(new AuthDialog(AuthDialog.Name, this.conversationState, this.userProfileState));
    }

    private authIfNeeded = async (step: WaterfallStepContext<RecognizerResult>) => {
        this.telemetryClient.trackEvent(Event.getEventFromContext(step.context, Event.SUPPORT_TICKET_START));

        let recognizerResults: RecognizerResult = step.options;

        if(recognizerResults) {
            await this.newSupportTicketState.set(step.context, {recognizerResults: recognizerResults});
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
    private checkProblemStatementPassedAsEntity = async (step: WaterfallStepContext<RecognizerResult>) => {
        let state = await this.newSupportTicketState.get(step.context);

        let recognizerResults: RecognizerResult;

        if(state.recognizerResults) {
            recognizerResults = state.recognizerResults;
        }

        if (!recognizerResults || !recognizerResults.entities) {
            const text = step.context.activity.text;
            recognizerResults = await this.supportTicketRecognizer.recognize(step.context);
        }

        if (recognizerResults.entities.problem) {
            let problemStatement = recognizerResults.entities.problem;
            if (problemStatement) {
                return step.next(problemStatement);
            }
        }

        return step.next();
    }

    async promptForProblemStatement(step: WaterfallStepContext) {
        if (!step.result) {
            return await step.prompt(ProblemStatementPrompt.Name, SupportTicketResponder.problem_statement_prompt());
        } else {
            await step.context.sendActivity(SupportTicketResponder.got_your_problem(step.result));
            return step.next(step.result);
        }
    }

    async searchForSolutions(step: WaterfallStepContext) {
        await step.context.sendActivity(SupportTicketResponder.looking_for_solutions(step.result));

        let problem: string;
        if(Array.isArray(step.result)) {
            problem = step.result[0];
        } else {
            problem = step.result;
        }

        let state = await this.newSupportTicketState.get(step.context);
        state.problem = problem;
        await this.newSupportTicketState.set(step.context, state);

        let answers: Answer[]; 
        try {
            answers = await this.supportKbService.searchForAnswers(problem, step.context, ANSWERS);
        } catch(error) {
            this.error(log, step.context, "Error in supportKbService.searchForAnswers", error);
        }

        if (answers == null) {
            await step.context.sendActivity(SupportTicketResponder.no_answer_found())
            this.telemetryClient.trackEvent(Event.getEventFromContext(step.context, Event.NO_SIMILAR_SOLUTION_FOUND));
            return await step.next(true);
        } else {
            this.telemetryClient.trackEvent(Event.getEventFromContext(step.context, Event.SHOW_SIMILAR_SOLUTIONS));

            let attachments: Attachment[] = [];

            for (let i: number = 0; i < answers.length; i++) {
                let answer = answers[i];
                attachments.push(this.getKbCard((i + 1) + '', answer.text, "http://www.bing.com"));
            }

            let carouselOfCards = MessageFactory.carousel(attachments);
            await step.context.sendActivity(carouselOfCards);

            return step.prompt(CONTINUE_OPENING_TICKET, SupportTicketResponder.question_continue_opening_ticket());
        }

    }

    async checkIfContinueOpeningTicket(step: WaterfallStepContext) {
        if (step.result === true) {
            let state = await this.newSupportTicketState.get(step.context);
            let userProfile = await this.userProfileState.get(step.context);

            let ticketId = await this.supportTicketService.openTicket(state.problem, userProfile.userPrincipalName);
            await step.context.sendActivity(SupportTicketResponder.inform_ticket_created(ticketId))
            this.telemetryClient.trackEvent(Event.getEventFromContext(step.context, Event.CONTINUE_CREATING_TICKET));
        } else {
            this.telemetryClient.trackEvent(Event.getEventFromContext(step.context, Event.STOP_TICKET_CREATION));
        }

        return await step.endDialog();
    }

    getKbCard(title: string, answer: string, url: string): Attachment {
        let json = JSON.parse(JSON.stringify(KbCard));

        json.body[0].items[0].text = title;
        json.body[1].items[0].text = answer;
        json.actions[0].title = SupportTicketResponder.link_desc();
        json.actions[0]['url'] = 'http://www.bing.com';

        const kbCard = CardFactory.adaptiveCard(json);

        return kbCard;
    }

}