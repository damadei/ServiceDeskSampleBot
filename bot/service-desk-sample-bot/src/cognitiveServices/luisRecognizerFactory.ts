// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { LuisApplication, LuisPredictionOptions, LuisRecognizer } from 'botbuilder-ai';
import { BotConfiguration, LuisService } from 'botframework-config';
import { LogFactory } from '../utils/logger';
import { TextLuisRecognizer } from '../utils/luisTextRecognizer';

const log = LogFactory.getLogger("LuisRecognizerFactory");

export class LuisRecognizerFactory {

    //recognizers cache
    private luisRecognizers: LuisRecognizer[] = [];

    private textLuisRecognizer: TextLuisRecognizer[] = [];

    constructor(private botConfiguration: BotConfiguration) {
    }

    public getTextLuisRecognizer(luisConfigName: string): TextLuisRecognizer {
        if (!this.textLuisRecognizer || !this.textLuisRecognizer[luisConfigName]) {

            const luisConfig = this.botConfiguration.findServiceByNameOrId(luisConfigName) as LuisService;

            if (!luisConfig) {
                throw new Error(`Luis Config ${luisConfigName} not found.`);
            }

            const luisApplication: LuisApplication = {
                applicationId: luisConfig.appId,
                endpoint: luisConfig.getEndpoint(),
                endpointKey: luisConfig.subscriptionKey,
            };

            let luisStaging = process.env.LUIS_ENVIRONMENT !== "prod";

            const luisPredictionOptions: LuisPredictionOptions = {
                includeAllIntents: true,
                log: true,
                staging: luisStaging
            };

            this.textLuisRecognizer[luisConfigName] = new TextLuisRecognizer(luisApplication, luisPredictionOptions, true);

            log.debug(`Text LUIS Recognizer created: ${this.textLuisRecognizer[luisConfigName]} for config name ${luisConfigName}`);
        } else {
            log.debug(`Returning a cached LUIS Recognizer for config name ${luisConfigName}`);
        }

        return this.textLuisRecognizer[luisConfigName];
    }

    public getLuisRecognizer(luisConfigName: string): LuisRecognizer {
        if (!this.luisRecognizers || !this.luisRecognizers[luisConfigName]) {
            const luisConfig = this.botConfiguration.findServiceByNameOrId(luisConfigName) as LuisService;

            if (!luisConfig) {
                throw new Error(`Luis Config ${luisConfigName} not found.`);
            }

            let luisStaging = process.env.LUIS_ENVIRONMENT !== "prod";

            log.info(`Creating new LuisRecognizer instance with config name ${luisConfigName} 
                for app id: ${luisConfig.appId} / endpoint: ${luisConfig.getEndpoint()} 
                / staging?: ${luisStaging}`);

            const luisApplication: LuisApplication = {
                applicationId: luisConfig.appId,
                endpoint: luisConfig.getEndpoint(),
                endpointKey: luisConfig.subscriptionKey,
            };

            const luisPredictionOptions: LuisPredictionOptions = {
                includeAllIntents: true,
                log: true,
                staging: luisStaging
            };

            this.luisRecognizers[luisConfigName] = new LuisRecognizer(luisApplication, luisPredictionOptions, true);

            log.debug(`LUIS Recognizer created: ${this.luisRecognizers[luisConfigName]} for config name ${luisConfigName}`);
        } else {
            log.debug(`Returning a cached LUIS Recognizer for config name ${luisConfigName}`);
        }

        return this.luisRecognizers[luisConfigName];
    }

}

export class TextRecognizer {

}