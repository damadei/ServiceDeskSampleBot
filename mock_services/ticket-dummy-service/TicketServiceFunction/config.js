const config = {};

config.host = process.env.HOST;
config.authKey = process.env.AUTH_KEY;
config.databaseId = "TicketDB";
config.collectionId = "TicketCollection";

module.exports = config;