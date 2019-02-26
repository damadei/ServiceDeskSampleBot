import { TelemetryEvent, TurnContext } from "botbuilder";

export class Event {
    public static readonly CANCEL = 'CANCEL';
    public static readonly CONVERSATION_STARTED = 'CONVERSATION_STARTED';
    public static readonly ACCOUNT_PASSWORD = 'ACCOUNT_PASSWORD';
    public static readonly INFO_PASSWORD_EXPIRATION = 'INFO_PASSWORD_EXPIRATION';
    public static readonly INFO_AND_RESET_PASSWORD = 'INFO_AND_RESET_PASSWORD';
    public static readonly INFO_CHANGE_PASSWORD = 'INFO_CHANGE_PASSWORD';
    public static readonly INFO_ACCOUNT_LOCKED = 'INFO_ACCOUNT_LOCKED';
    public static readonly LOGIN_START = 'LOGIN_START';
    public static readonly LOGIN_SUCCESS = 'LOGIN_SUCCESS';
    public static readonly LOGIN_FAILURE = 'LOGIN_FAILURE';
    public static readonly SUPPORT_TICKET_START = 'SUPPORT_TICKET_START';
    public static readonly NO_SIMILAR_SOLUTION_FOUND = 'NO_SIMILAR_SOLUTION_FOUND';
    public static readonly SHOW_SIMILAR_SOLUTIONS = 'SHOW_SIMILAR_SOLUTIONS';
    public static readonly PASSWORD_RESET_START = 'PASSWORD_RESET_START';
    public static readonly CONTINUE_CREATING_TICKET = 'CONTINUE_CREATING_TICKET';
    public static readonly STOP_TICKET_CREATION = 'STOP_TICKET_CREATION';
    public static readonly QUERY_TICKETS = 'QUERY_TICKETS';

    public static getEvent(conversationId: string, activityId: string, eventName: string) { 
        let telemetry: TelemetryEvent = {
            name: eventName
        }

        telemetry.properties = {
            ["conversationId"]: conversationId,
            ["activityId"]: activityId
        }

        return telemetry;
    }

    public static getEventFromContext(turnContext: TurnContext, eventName: string) { 
        let conversationId = turnContext.activity.conversation.id;
        let activityId = turnContext.activity.id;

        let telemetry: TelemetryEvent = {
            name: eventName
        }

        telemetry.properties = {
            ["conversationId"]: conversationId,
            ["activityId"]: activityId
        }

        return telemetry;
    }
}