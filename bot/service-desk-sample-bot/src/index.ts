// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { config } from 'dotenv';
import * as path from 'path';
import * as restify from 'restify';
import * as dotenv from 'dotenv'

dotenv.load();

// Import required bot services.
// See https://aka.ms/bot-services to learn more about the different parts of a bot.
import { BotFrameworkAdapter, MemoryStorage, ConversationState, UserState, TelemetryException } from 'botbuilder';

// Import required bot configuration.
import { BotConfiguration, IEndpointService } from 'botframework-config';

// This bot's main dialog.
import { ServiceDeskBot } from './bot';
import { LuisRecognizerFactory } from './cognitiveServices/luisRecognizerFactory';
import { QnAMakerFactory } from './cognitiveServices/qnaMakerFactory';
import { GraphService } from './services/graph/graphService';
import { SmsService } from './services/sms/smsService';
import { GenericResponder } from './utils/responder';
import { LogFactory } from './utils/logger';
import { BlobStorage } from 'botbuilder-azure';
import { ApplicationInsightsTelemetryClient, ApplicationInsightsWebserverMiddleware } from 'botbuilder-applicationinsights';
import { TelemetryClient } from 'applicationinsights';

const log = LogFactory.getLogger("index");

// Read botFilePath and botFileSecret from .env file.
// Note: Ensure you have a .env file and include botFilePath and botFileSecret.
const ENV_FILE = path.join(__dirname, '..', '.env');
config({ path: ENV_FILE });

// bot endpoint name as defined in .bot file
// See https://aka.ms/about-bot-file to learn more about .bot file its use and bot configuration.
const DEV_ENVIRONMENT = 'development';

// bot name as defined in .bot file
// See https://aka.ms/about-bot-file to learn more about .bot file its use and bot configuration.
const BOT_CONFIGURATION = (process.env.NODE_ENV || DEV_ENVIRONMENT);

// Create HTTP server.
const server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, () => {
    console.log(`\n${server.name} listening to ${server.url}`);
    console.log(`\nGet Bot Framework Emulator: https://aka.ms/botframework-emulator`);
    console.log(`\nTo talk to your bot, open ServiceDeskSampleBot.bot file in the Emulator.`);
});

// .bot file path
const BOT_FILE = path.join(__dirname, '..', (process.env.botFilePath || ''));

// Read bot configuration from .bot file.
let botConfig;
try {
    botConfig = BotConfiguration.loadSync(BOT_FILE, process.env.botFileSecret);
} catch (err) {
    console.error(`\nError reading bot file. Please ensure you have valid botFilePath and botFileSecret set for your environment.`);
    console.error(`\n - The botFileSecret is available under appsettings for your Azure Bot Service bot.`);
    console.error(`\n - If you are running this bot locally, consider adding a .env file with botFilePath and botFileSecret.`);
    console.error(`\n - See https://aka.ms/about-bot-file to learn more about .bot file its use and bot configuration.\n\n`);
    process.exit();
}

// Get bot endpoint configuration by service name
const endpointConfig = botConfig.findServiceByNameOrId(BOT_CONFIGURATION) as IEndpointService;

const APP_INSIGHTS_CONFIGURATION = null; // Define a specific instance of Application Insights (if required)

// App Insights
const appInsightsConfig = APP_INSIGHTS_CONFIGURATION
                                ?
                                botConfig.findServiceByNameOrId(APP_INSIGHTS_CONFIGURATION)
                                :
                                botConfig.services.filter((m) => m.type === 'appInsights').length ? botConfig.services.filter((m) => m.type === 'appInsights')[0] : null;
if (!appInsightsConfig) {
    throw new Error("No App Insights configuration was found.");
}

const appInsightsClient = new ApplicationInsightsTelemetryClient(appInsightsConfig.instrumentationKey);

server.use(ApplicationInsightsWebserverMiddleware);

// Create adapter.
// See https://aka.ms/about-bot-adapter to learn more about .bot file its use and bot configuration.
const adapter = new BotFrameworkAdapter({
    appId: endpointConfig.appId || process.env.microsoftAppID,
    appPassword: endpointConfig.appPassword || process.env.microsoftAppPassword,
});


// Catch-all for errors.
adapter.onTurnError = async (context, error) => {
    let activityId = context.activity.id;
    let conversationId = context.activity.conversation.id;

    console.error(`[${conversationId}][${activityId}] Error: ${error}`);
    console.error(`[${conversationId}][${activityId}] Stack: ${error.stack}`);

    log.error(`[${conversationId}][${activityId}] Error: ${error}`);
    log.error(`[${conversationId}][${activityId}] Stack: ${error.stack}`);


    let exception: TelemetryException = {
        exception: error
    };

    exception.properties = { 
        "activityId": activityId, 
        "conversationId": conversationId
    };

    appInsightsClient.trackException(exception);

    // Send a message to the user
    await context.sendActivity(GenericResponder.unexpected_error(activityId));
};

const STORAGE_CONFIGURATION_ID = 'BotStorage'
const DEFAULT_BOT_CONTAINER = 'botstorage'

const blobStorageConfig = botConfig.findServiceByNameOrId(STORAGE_CONFIGURATION_ID);
const blobStorage = new BlobStorage({
     containerName: (blobStorageConfig.container || DEFAULT_BOT_CONTAINER),
     storageAccountOrConnectionString: blobStorageConfig.connectionString,
});

const conversationState = new ConversationState(blobStorage);
const userState = new UserState(blobStorage);

const luisRecognizerFactory = new LuisRecognizerFactory(botConfig);
const qnaMakerFactory = new QnAMakerFactory(botConfig);

const graphService = new GraphService();
const smsService = new SmsService();

// Create the main dialog.
const serviceDeskBot = new ServiceDeskBot(
                            conversationState, 
                            userState, 
                            appInsightsClient,
                            luisRecognizerFactory, 
                            qnaMakerFactory,
                            graphService, 
                            smsService);

// Listen for incoming requests.
server.post('/api/messages', (req, res) => {
    adapter.processActivity(req, res, async (context) => {
        // Route to main dialog.
        await serviceDeskBot.onTurn(context);
    });
});
