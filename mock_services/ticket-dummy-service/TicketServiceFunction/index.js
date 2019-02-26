const TicketDao = require('./ticketDao');
const config = require('./config');
const createHandler = require("azure-function-express").createHandler;
const express = require("express");

const app = express();
//app.use(express.json())

let dao = new TicketDao(config.databaseId, config.collectionId, config.host, config.authKey);

app.get("/ticket", async (req, res) => {
  try { 
    let result = await dao.queryTicketsByUserAndStatus(req.query.userId, req.query.status);
    res.json(result);
  } catch(error) {
    handleError(req, res, error);
  }
});

app.get("/ticket/last", async (req, res) => {
    try {
        let result = await dao.getLastTicketByUser(req.query.userId, req.params.ticketId);
        res.json(result);
    } catch(error) {
        handleError(req, res, error);
    }
});

app.get("/ticket/:ticketId", async (req, res) => {
    try {
        let result = await dao.getTicketByUserAndId(req.query.userId, req.params.ticketId);
        res.json(result);
    } catch(error) {
        handleError(req, res, error);
    }
});

app.post("/ticket", async (req, res) => {
    try {
        let result = await dao.createTicket(req.body);
        res.json(result);
    } catch(error) {
        handleError(req, res, error);
    }
});

function handleError(req, res, error) {
    req.context.log(error);

    let status;
    if(error.code) {
        status = error.code;    
    } else {
        status = 500;
    }

    let message;
    if(error.message) {
        message = error.message;
    } else if(error.body) {
        let body = JSON.parse(error.body);
        message = body.message;
    }

    res.status(status).json({ success: false, error: message });
}

module.exports = createHandler(app);