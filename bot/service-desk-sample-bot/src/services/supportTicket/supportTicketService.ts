import { TurnContext } from "botbuilder";
import { generate as generateRandomString } from 'randomstring';
import { SupportTicket } from "../../model/supportTicket";
import * as request from 'request-promise';
import * as http from 'http';
import * as https from 'https';
import { LogFactory } from "../../utils/logger";

const baseUrl = process.env.TICKET_SERVICE_BASE_URL;
const keepAliveAgent = new http.Agent({ keepAlive: true });
const keepAliveAgentHttps = new https.Agent({ keepAlive: true });
const log = LogFactory.getLogger("QuerySupportTicketsDialog");

export class SupportTicketService {

    constructor() {
    }

    /**
     * Search knowledge base for answers for the returned problem
     * 
     * @param problem Problem statement
     */
    async openTicket(problem: string, userId: string): Promise<string> {
        let id = this.genTicketId();

        let ticket = new SupportTicket();
        ticket.id = id;
        ticket.description = problem;
        ticket.openDate = new Date();
        ticket.status = SupportTicket.STATUS_OPEN;
        ticket.userId = userId;
        ticket.lastUpdate = new Date();

        try {
            let url = `${baseUrl}/ticket`;
            await post(url, ticket);
        } catch(error) {
            log.error(error);
            throw error;
        }

        return id;
    }
   
    async queryTicketsByStatusAndUser(userPrincipalName: string, status: number): Promise<SupportTicket[]> {
        try {
            let url = `${baseUrl}/ticket?userId=${userPrincipalName}&status=${status}`;
            return await get(url);
        } catch(error) {
            log.error(error);
            throw error;
        }
    }

    async getTicketByIdAndUser(userPrincipalName: string, ticketId: string): Promise<SupportTicket> {
        try {
            let url = `${baseUrl}/ticket/${ticketId}?userId=${userPrincipalName}`;
            return await get(url);
        } catch(error) {
            log.error(error);
            throw error;
        }
    }

    async getLastTicketByUser(userPrincipalName: string, ): Promise<SupportTicket> {
        try {
            let url = `${baseUrl}/ticket/last?userId=${userPrincipalName}`;
            let result = await get(url);
            if(result && result.length > 0) {
                return result[0];
            } else {
                return null;
            }
        } catch(error) {
            log.error(error);
            throw error;
        }
    }

    genTicketId() {
        return generateRandomString({
            length: 6,
            charset: 'numeric'
        });
    }
}

async function post(url: string, body: any) {
    let result = await request.post({
        url: url,
        headers: getBaseHeaders(),
        agent: getAgent(url),
        json: body
    });

    return result;
}

async function get(url: string) {
    let result = await request.get({
        url: url,
        headers: getBaseHeaders(),
        agent: getAgent(url)
    });

    if(result) {
        result = JSON.parse(result);
    }

    return result;
}

function getAgent(url: string) {
    if(url.startsWith("https")) {
        return keepAliveAgentHttps;
    } else {
        return keepAliveAgent;
    }
}

function getBaseHeaders() {
    return { "x-functions-key": process.env.TICKET_SERVICE_KEY };
}