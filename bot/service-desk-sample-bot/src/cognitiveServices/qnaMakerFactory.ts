import { LuisRecognizer, QnAMaker } from 'botbuilder-ai';
import { BotConfiguration, QnaMakerService } from 'botframework-config';
import {LogFactory} from '../utils/logger';

const log = LogFactory.getLogger("QnaMakerFactory");

export class QnAMakerFactory {

    //recognizers cache
    private qnaMakers: QnAMaker[] = [];

    constructor(private botConfiguration: BotConfiguration) {
    }

    public getQnAMaker(qnaConfigName: string): QnAMaker {
        if(!this.qnaMakers[qnaConfigName]) {
            const qnaConfig = this.botConfiguration.findServiceByNameOrId(qnaConfigName) as QnaMakerService;

            if(!qnaConfig) {
                throw new Error(`QnA Config ${qnaConfigName} not found.`);
            } else if(!qnaConfig.kbId) {
                throw new Error(`QnA Config ${qnaConfigName} KbId not found.`);
            }

            log.info(`Creating new QnAMaker instance with config name ${qnaConfigName} 
                for kb id: ${qnaConfig.kbId} / hostname: ${qnaConfig.hostname}`);

            this.qnaMakers[qnaConfigName] = new QnAMaker({
                knowledgeBaseId: qnaConfig.kbId,
                endpointKey: qnaConfig.endpointKey,
                host: qnaConfig.hostname
            });

            log.debug(`QnAMaker created: ${this.qnaMakers[qnaConfigName]} for config name ${qnaConfigName}`);
        } else {
            log.debug(`Returning a cached QnA Maker for config name ${qnaConfigName}`);
        }

        return this.qnaMakers[qnaConfigName];
    }

}
