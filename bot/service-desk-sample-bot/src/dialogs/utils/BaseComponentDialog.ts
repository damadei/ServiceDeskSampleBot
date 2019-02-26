import { ComponentDialog } from "botbuilder-dialogs";
import { Logger } from "typescript-logging";
import { TurnContext } from "botbuilder";

export class BaseComponentDialog extends ComponentDialog {

    public debug(logger: Logger, context: TurnContext, message: string, error?: any) {
        let activityId = context.activity.id;
        let conversationId = context.activity.conversation.id;

        logger.debug(`[${conversationId}][${activityId}] ${message}`, error);
    }

    public info(logger: Logger, context: TurnContext, message: string, error?: any) {
        let activityId = context.activity.id;
        let conversationId = context.activity.conversation.id;

        logger.info(`[${conversationId}][${activityId}] ${message}`, error);
    }

    public warn(logger: Logger, context: TurnContext, message: string, error?: any) {
        let activityId = context.activity.id;
        let conversationId = context.activity.conversation.id;

        logger.warn(`[${conversationId}][${activityId}] ${message}`, error);
    }

    public error(logger: Logger, context: TurnContext, message: string, error?: any) {
        let activityId = context.activity.id;
        let conversationId = context.activity.conversation.id;

        logger.error(`[${conversationId}][${activityId}] ${message}`, error);
    }


}
