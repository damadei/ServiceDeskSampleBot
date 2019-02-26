// greeting.js defines the greeting dialog
import { ComponentDialog, WaterfallDialog, WaterfallStepContext, ConfirmPrompt, DialogTurnResult } from 'botbuilder-dialogs';
import { LogFactory } from '../../utils/logger';
import { GenericResponder } from '../../utils/responder';
import { GlobalConfig } from '../../utils/globalConfig';
import { TelemetryClient } from 'applicationinsights';

const log = LogFactory.getLogger("GoodbyeDialog");

// local prompts
const NEED_ANYTHING_ELSE_PROMPT = 'needAnythingElsePrompt';

/**
 * Goodbye Dialog
 * 
 * @param {String} dialogId unique identifier for this dialog instance
 */
export class GoodbyeDialog extends ComponentDialog {

    public static readonly Name: string = "GoodbyeDialog";

    constructor(dialogId: string) {
        super(dialogId);

        // validate what was passed in
        if (!dialogId) { throw Error('Missing parameter.  dialogId is required'); }

        this.addDialog(new WaterfallDialog('startGoodbyeDialog', [
          this.promptIfNeedAnythingElse.bind(this),
          this.handleResponse.bind(this),
        ]));

        this.addDialog(new ConfirmPrompt(NEED_ANYTHING_ELSE_PROMPT, null, GlobalConfig.locale));
    }

    /**
     * @param {WaterfallStepContext} step contextual information for the current step being executed
     */
    private promptIfNeedAnythingElse = async (step: WaterfallStepContext) => {
        return step.prompt(NEED_ANYTHING_ELSE_PROMPT, GenericResponder.question_need_anything_else());
    }

    /**
     * @param {WaterfallStepContext} step contextual information for the current step being executed
     */
    private handleResponse = async (step: WaterfallStepContext) => {
        if(step.result === true) { //answered yes
            await step.context.sendActivity(GenericResponder.i_am_available());
        } else {
            await step.context.sendActivity(GenericResponder.thanks());
        }
     
        return step.endDialog({goodbye: true});
    }

}
