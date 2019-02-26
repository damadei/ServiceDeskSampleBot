// greeting.js defines the greeting dialog
import { WaterfallDialog, WaterfallStepContext, ConfirmPrompt } from 'botbuilder-dialogs';
import { QnAMaker, LuisRecognizer } from 'botbuilder-ai';
import { RecognizerResult } from 'botbuilder';
import { QnAMakerFactory } from '../../cognitiveServices/qnaMakerFactory'
import { LogFactory } from '../../utils/logger';
import { GenericResponder, AccountPasswordFaqResponder } from '../../utils/responder';
import { PasswordResetDialog } from '../passwordReset/passwordReset'
import { GlobalConfig } from '../../utils/globalConfig';
import { BaseComponentDialog } from '../utils/BaseComponentDialog';
import { TelemetryClient } from 'applicationinsights';
import { Event } from '../../utils/events';

const QNA_MAKER_CONFIG_NAME = 'qna_service_desk_account_password';
const QNA_TOP_N = 1;

const log = LogFactory.getLogger("AccountPasswordFaqDialog");

const INFO_AND_RESET_PASSWORD = "INFO_AND_RESET_PASSWORD"
const INFO_CHANGE_PASSWORD = "INFO_CHANGE_PASSWORD"
const INFO_ACCOUNT_LOCKED = "INFO_ACCOUNT_LOCKED"
const INFO_PASSWORD_EXPIRATION = "INFO_PASSWORD_EXPIRATION";

const CONFIRM_CANCEL_PROMPT = 'confirmCancelPrompt';

/**
 * Password FAQ for integration with QnA Maker
 * 
 * @param {String} dialogId unique identifier for this dialog instance
 */
export class AccountPasswordFaqDialog extends BaseComponentDialog {

    public static readonly Name: string = "AccountPasswordFaqDialog";

    private qnaMaker: QnAMaker;

    constructor(dialogId: string, qnaMakerFactory: QnAMakerFactory) {
        super(dialogId);

        // validate what was passed in
        if (!dialogId) { throw Error('Missing parameter.  dialogId is required'); }

        this.addDialog(new WaterfallDialog('start', [
          this.getAnswer.bind(this),
          this.questionIfNeeded.bind(this),
          this.redirectIfNeeded.bind(this)
        ]));

        this.addDialog(new ConfirmPrompt(CONFIRM_CANCEL_PROMPT, null, GlobalConfig.locale));

        this.qnaMaker = qnaMakerFactory.getQnAMaker(QNA_MAKER_CONFIG_NAME);
    }

    /**
     * @param {WaterfallStepContext} step contextual information for the current step being executed
     */
    private getAnswer = async (step: WaterfallStepContext<RecognizerResult>) => {
        this.telemetryClient.trackEvent(Event.getEventFromContext(step.context, Event.ACCOUNT_PASSWORD));

        const text = step.context.activity.text;

        const qnaResult = await this.qnaMaker.generateAnswer(text, QNA_TOP_N);
        if (!qnaResult || qnaResult.length === 0 || !qnaResult[0].answer) {
            this.error(log, step.context, `Unable to retrieve answer from QnA for FAQ-Senha. Text: ${ text } `);
            await step.context.sendActivity(GenericResponder.could_not_understand());
            return;
        } else {
            await step.context.sendActivity(qnaResult[0].answer);
        }

        return await step.next(step.options);
    }

    /**
     * @param {WaterfallStepContext} step contextual information for the current step being executed
     */
    private questionIfNeeded = async (step: WaterfallStepContext<RecognizerResult>) => {
        const topIntent = LuisRecognizer.topIntent(step.options);

        switch (topIntent) {
            case INFO_PASSWORD_EXPIRATION:
                this.telemetryClient.trackEvent(Event.getEventFromContext(step.context, Event.INFO_PASSWORD_EXPIRATION));   
            case INFO_AND_RESET_PASSWORD:
                this.telemetryClient.trackEvent(Event.getEventFromContext(step.context, Event.INFO_AND_RESET_PASSWORD));
            case INFO_ACCOUNT_LOCKED: 
                this.telemetryClient.trackEvent(Event.getEventFromContext(step.context, Event.INFO_ACCOUNT_LOCKED));
            case INFO_CHANGE_PASSWORD: 
                this.telemetryClient.trackEvent(Event.getEventFromContext(step.context, Event.INFO_CHANGE_PASSWORD));
                let result = await step.prompt(CONFIRM_CANCEL_PROMPT, AccountPasswordFaqResponder.question_redirect_to_password_reset());
                return result;
            default:
                return await step.endDialog();
                break;
        }
    }

    private redirectIfNeeded = async (step: WaterfallStepContext) => {
        let result;
        if(step.result) {
            result = await step.endDialog({redirect: true, to: PasswordResetDialog.Name});
        } else {
            result = await step.endDialog();
        }

        return result;
    }

}
