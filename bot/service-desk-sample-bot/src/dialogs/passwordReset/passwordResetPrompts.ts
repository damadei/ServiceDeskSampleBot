import { TextPrompt, NumberPrompt } from 'botbuilder-dialogs';
import { PasswordResetResponder } from '../../utils/responder';
import { StatePropertyAccessor } from 'botbuilder';
import { PasswordReset } from '../../model/passwordReset';
import { LogFactory } from '../../utils/logger';

export class UserIdPrompt extends TextPrompt {

    private readonly log = LogFactory.getLogger("UserIdPrompt");
    
    public static Name: string = 'UserIdPrompt';

    constructor(dialogId: string) {
        super(dialogId, async (prompt) => {
            if (!prompt.recognized.succeeded) {
                this.log.info("!prompt.recognized.succeeded");
                await prompt.context.sendActivity(PasswordResetResponder.user_id_reprompt());
                return false;
            } else {
                const value = prompt.recognized.value;
                if (value.length < 3) {
                    this.log.info("prompt.recognized.value < 3");
                    await prompt.context.sendActivity(PasswordResetResponder.invalid_user_id_too_small(3));
                    return false;
                } else if (value.length > 50) {
                    this.log.info("prompt.recognized.value > 50");
                    await prompt.context.sendActivity(PasswordResetResponder.invalid_user_id_too_big(50));
                    return false;
                } else {
                    return true;
                }
            }
        });
    }
};

export class MagicCodeValidationPrompt extends NumberPrompt {

    public static Name: string = 'MagicCodeValidationPrompt';

    constructor(dialogId: string, passwordResetState: StatePropertyAccessor<PasswordReset>) {
        super(dialogId, async (prompt) => {
            if (!prompt.recognized.succeeded) {
                await prompt.context.sendActivity(PasswordResetResponder.invalid_magic_code());
                return false;
            } else {
                const value = prompt.recognized.value;

                const state = await passwordResetState.get(prompt.context, new PasswordReset());
                let magicCode = state.magicCode;

                if (value === magicCode) {
                    return true;
                } else {
                    await prompt.context.sendActivity(PasswordResetResponder.invalid_magic_code());
                    return false;
                }
            }
        });
    }
};