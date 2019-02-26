import { TextPrompt, NumberPrompt } from 'botbuilder-dialogs';
import { PasswordResetResponder, SupportTicketResponder } from '../../utils/responder';
import { LogFactory } from '../../utils/logger';

export class ProblemStatementPrompt extends TextPrompt {

    private readonly log = LogFactory.getLogger("ProblemStatementPrompt");
    
    public static Name: string = 'ProblemStatementPrompt';

    constructor(dialogId: string) {
        super(dialogId, async (prompt) => {
            if (!prompt.recognized.succeeded) {
                await prompt.context.sendActivity(SupportTicketResponder.problem_statement_reprompt());
                return false;
            } else {
                const value = prompt.recognized.value;
                if (value.length <= 10) {
                    await prompt.context.sendActivity(SupportTicketResponder.problem_statement_too_small());
                    return false;
                } else {
                    return true;
                }
            }
        });
    }
};
