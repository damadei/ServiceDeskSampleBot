const CosmosClient = require("@azure/cosmos").CosmosClient;
const debug = require("debug")("todo:taskDao");

const STATUS_OPEN = 0;

class TicketDao {

    constructor(databaseId, collectionId, cosmosEndpoint, cosmosKey) {
        this.client = new CosmosClient({
            endpoint: cosmosEndpoint,
            auth: {
                masterKey: cosmosKey
            }
        });
        this.databaseId = databaseId;
        this.collectionId = collectionId;

        this.database = this.client.database(this.databaseId);
        this.collection = this.database.container(this.collectionId);
    }

    async queryTicketsByUserAndStatus(userId, status) {
        const querySpec = {
            query: "SELECT * FROM ticket t WHERE t.status = @status AND t.userId = @userId",
            parameters: [
                {
                    name: "@status",
                    value: parseInt(status)
                },
                {
                    name: "@userId",
                    value: userId
                }
            ]
        };

        const items = await this.find(querySpec);
        return items;
    }

    async getLastTicketByUser(userId, status) {
        const querySpec = {
            query: `SELECT TOP 1 * 
                    FROM ticket t WHERE t.userId = @userId
                    ORDER BY t.lastUpdate DESC`,
            parameters: [
                {
                    name: "@userId",
                    value: userId
                }
            ]
        };

        const items = await this.find(querySpec);
        return items;
    }


    async find(querySpec) {
        debug("Querying for items from the database");
        if (!this.collection) {
            throw new Error("Collection is not initialized.");
        }
        const { result: results } = await this.collection.items
            .query(querySpec, { enableCrossPartitionQuery: true })
            .toArray();
        return results;
    }

    async getTicketByUserAndId(userId, ticketId) {

        if(!userId) {
            throw "User id is required";
        }

        if(!ticketId) {
            throw "Ticket id is required";
        }

        let ticketItem = await this.collection.item(ticketId, ticketId).read();

        if(ticketItem.body) {
            let ticket = ticketItem.body;

            if(ticket.userId === userId) {
                return ticket;
            } else {
                debug(`Ticket ${ticketId} not from user ${userId}`);
                return {};
            }
        }


        return {};
    }

    async createTicket(ticket) {
        debug("Creating ticket");
        const { body: doc } = await this.collection.items.create(ticket);
        return doc;
    }
}

module.exports = TicketDao;