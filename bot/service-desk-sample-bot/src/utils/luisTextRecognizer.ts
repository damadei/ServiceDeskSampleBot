import { LUISRuntimeClient as LuisClient, LUISRuntimeModels as LuisModels } from 'azure-cognitiveservices-luis-runtime';
import { RecognizerResult, TurnContext } from 'botbuilder';
import * as msRest from 'ms-rest';
import * as os from 'os';
import { LuisApplication, LuisPredictionOptions } from 'botbuilder-ai';

const LUIS_TRACE_TYPE: string = 'https://www.luis.ai/schemas/trace';
const LUIS_TRACE_NAME: string = 'LuisRecognizer';
const LUIS_TRACE_LABEL: string = 'Luis Trace';

export class TextLuisRecognizer {
    private application: LuisApplication;
    private options: LuisPredictionOptions;
    private includeApiResults: boolean;

    private luisClient: LuisClient;
    private cacheKey: symbol = Symbol('results');

    constructor(application: LuisApplication, options?: LuisPredictionOptions, includeApiResults?: boolean) {
        this.application = application;
        this.options = {
            includeAllIntents: false,
            includeInstanceData: true,
            log: true,
            spellCheck: false,
            staging: false, ...options
        };
        this.includeApiResults = !!includeApiResults;

        const creds: msRest.TokenCredentials = new msRest.TokenCredentials(application.endpointKey);
        const baseUri: string = this.application.endpoint || 'https://westus.api.cognitive.microsoft.com';
        this.luisClient = new LuisClient(creds, baseUri);
    }

    public async recognize(text: string = null): Promise<RecognizerResult> {
        const utterance: string = text;

        let luisResult = await this.luisClient.prediction.resolve(
            this.application.applicationId, utterance,
            {
                verbose: this.options.includeAllIntents,
                customHeaders: {
                    'Ocp-Apim-Subscription-Key': this.application.endpointKey,
                    'User-Agent': this.getUserAgent()
                },
                ...this.options
            }
        );

        const recognizerResult: RecognizerResult = {
            text: luisResult.query,
            alteredText: luisResult.alteredQuery,
            intents: this.getIntents(luisResult),
            entities: this.getEntitiesAndMetadata(
                luisResult.entities,
                luisResult.compositeEntities,
                this.options.includeInstanceData === undefined || this.options.includeInstanceData
            ),
            sentiment: this.getSentiment(luisResult),
            luisResult: this.includeApiResults ? luisResult : null
        };

        return recognizerResult;
    }

    private getUserAgent(): string {
        // Note when the ms-rest dependency the LuisClient uses has been updated
        // this code should be modified to use the client's addUserAgentInfo() function.

        const packageUserAgent = `ServiceDeskSampleBot/1.0.0`;
        const platformUserAgent = `(${os.arch()}-${os.type()}-${os.release()}; Node.js,Version=${process.version})`;
        const userAgent = `${packageUserAgent} ${platformUserAgent}`;

        return userAgent;
    }


    private prepareErrorMessage(error: Error): void {
        if ((error as any).response && (error as any).response.statusCode) {
            switch ((error as any).response.statusCode) {
                case 400:
                    error.message = [
                        `Response 400: The request's body or parameters are incorrect,`,
                        `meaning they are missing, malformed, or too large.`
                    ].join(' ');
                    break;
                case 401:
                    error.message = `Response 401: The key used is invalid, malformed, empty, or doesn't match the region.`;
                    break;
                case 403:
                    error.message = `Response 403: Total monthly key quota limit exceeded.`;
                    break;
                case 409:
                    error.message = `Response 409: Application loading in progress, please try again.`;
                    break;
                case 410:
                    error.message = `Response 410: Please retrain and republish your application.`;
                    break;
                case 414:
                    error.message = `Response 414: The query is too long. Please reduce the query length to 500 or less characters.`;
                    break;
                case 429:
                    error.message = `Response 429: Too many requests.`;
                    break;
                default:
                    error.message = [
                        `Response ${(error as any).response.statusCode}: Unexpected status code received.`,
                        `Please verify that your LUIS application is properly setup.`
                    ].join(' ');
            }
        }
    }

    private normalizeName(name: string): string {
        return name.replace(/\.| /g, '_');
    }

    private getIntents(luisResult: LuisModels.LuisResult): any {
        const intents: { [name: string]: { score: number } } = {};
        if (luisResult.intents) {
            luisResult.intents.reduce(
                (prev: any, curr: LuisModels.IntentModel) => {
                    prev[this.normalizeName(curr.intent)] = { score: curr.score };

                    return prev;
                },
                intents
            );
        } else {
            const topScoringIntent: LuisModels.IntentModel = luisResult.topScoringIntent;
            intents[this.normalizeName((topScoringIntent).intent)] = { score: topScoringIntent.score };
        }

        return intents;
    }

    private getEntitiesAndMetadata(
        entities: LuisModels.EntityModel[],
        compositeEntities: LuisModels.CompositeEntityModel[] | undefined,
        verbose: boolean): any {
        const entitiesAndMetadata: any = verbose ? { $instance: {} } : {};
        let compositeEntityTypes: string[] = [];

        // We start by populating composite entities so that entities covered by them are removed from the entities list
        if (compositeEntities) {
            compositeEntityTypes = compositeEntities.map((compositeEntity: LuisModels.CompositeEntityModel) => compositeEntity.parentType);
            compositeEntities.forEach((compositeEntity: LuisModels.CompositeEntityModel) => {
                entities = this.populateCompositeEntity(compositeEntity, entities, entitiesAndMetadata, verbose);
            });
        }

        entities.forEach((entity: LuisModels.EntityModel) => {
            // we'll address composite entities separately
            if (compositeEntityTypes.indexOf(entity.type) > -1) {
                return;
            }

            this.addProperty(entitiesAndMetadata, this.getNormalizedEntityName(entity), this.getEntityValue(entity));
            if (verbose) {
                this.addProperty(entitiesAndMetadata.$instance, this.getNormalizedEntityName(entity), this.getEntityMetadata(entity));
            }
        });

        return entitiesAndMetadata;
    }

    private getEntityValue(entity: LuisModels.EntityModel): any {
        if (!entity.resolution) {
            return entity.entity;
        }

        if (entity.type.startsWith('builtin.datetimeV2.')) {
            if (!entity.resolution.values || !entity.resolution.values.length) {
                return entity.resolution;
            }

            const vals: any = entity.resolution.values;
            const type: any = vals[0].type;
            const timexes: any[] = vals.map((t: any) => t.timex);
            const distinct: any = timexes.filter((v: any, i: number, a: any[]) => a.indexOf(v) === i);

            return { type: type, timex: distinct };
        } else {
            const res: any = entity.resolution;
            switch (entity.type) {
                case 'builtin.number':
                case 'builtin.ordinal': return Number(res.value);
                case 'builtin.percentage':
                    {
                        let svalue: string = res.value;
                        if (svalue.endsWith('%')) {
                            svalue = svalue.substring(0, svalue.length - 1);
                        }

                        return Number(svalue);
                    }
                case 'builtin.age':
                case 'builtin.dimension':
                case 'builtin.currency':
                case 'builtin.temperature':
                    {
                        const val: any = res.value;
                        const obj: any = {};
                        if (val) {
                            obj.number = Number(val);
                        }
                        obj.units = res.unit;

                        return obj;
                    }
                default:
                    return Object.keys(entity.resolution).length > 1 ?
                        entity.resolution :
                        entity.resolution.value ?
                            entity.resolution.value :
                            entity.resolution.values;
            }
        }
    }

    private getEntityMetadata(entity: LuisModels.EntityModel): any {
        const res: any = {
            startIndex: entity.startIndex,
            endIndex: entity.endIndex + 1,
            score: entity.score,
            text: entity.entity,
            type: entity.type
        };
        if (entity.resolution && entity.resolution.subtype) {
            res.subtype = entity.resolution.subtype;
        }

        return res;
    }

    private getNormalizedEntityName(entity: LuisModels.EntityModel): string {
        // Type::Role -> Role
        let type: string = entity.type.split(':').pop();
        if (type.startsWith('builtin.datetimeV2.')) {
            type = 'datetime';
        }
        if (type.startsWith('builtin.currency')) {
            type = 'money';
        }
        if (type.startsWith('builtin.')) {
            type = type.substring(8);
        }
        if (entity.role !== null && entity.role !== '' && entity.role !== undefined) {
            type = entity.role;
        }

        return type.replace(/\.|\s/g, '_');
    }

    private populateCompositeEntity(
        compositeEntity: LuisModels.CompositeEntityModel,
        entities: LuisModels.EntityModel[],
        entitiesAndMetadata: any,
        verbose: boolean
    ): LuisModels.EntityModel[] {
        const childrenEntites: any = verbose ? { $instance: {} } : {};
        let childrenEntitiesMetadata: any = {};

        // This is now implemented as O(n^2) search and can be reduced to O(2n) using a map as an optimization if n grows
        const compositeEntityMetadata: LuisModels.EntityModel | undefined = entities.find((entity: LuisModels.EntityModel) => {
            // For now we are matching by value, which can be ambiguous if the same composite entity shows up with the same text
            // multiple times within an utterance, but this is just a stop gap solution till the indices are included in composite entities
            return entity.type === compositeEntity.parentType && entity.entity === compositeEntity.value;
        });

        const filteredEntities: LuisModels.EntityModel[] = [];
        if (verbose) {
            childrenEntitiesMetadata = this.getEntityMetadata(compositeEntityMetadata);
        }

        // This is now implemented as O(n*k) search and can be reduced to O(n + k) using a map as an optimization if n or k grow
        const coveredSet: Set<any> = new Set();
        compositeEntity.children.forEach((childEntity: LuisModels.CompositeChildModel) => {
            for (let i: number = 0; i < entities.length; i++) {
                const entity: LuisModels.EntityModel = entities[i];
                if (!coveredSet.has(i) &&
                    childEntity.type === entity.type &&
                    compositeEntityMetadata &&
                    entity.startIndex !== undefined &&
                    compositeEntityMetadata.startIndex !== undefined &&
                    entity.startIndex >= compositeEntityMetadata.startIndex &&
                    entity.endIndex !== undefined &&
                    compositeEntityMetadata.endIndex !== undefined &&
                    entity.endIndex <= compositeEntityMetadata.endIndex
                ) {

                    // Add to the set to ensure that we don't consider the same child entity more than once per composite
                    coveredSet.add(i);
                    this.addProperty(childrenEntites, this.getNormalizedEntityName(entity), this.getEntityValue(entity));

                    if (verbose) {
                        this.addProperty(childrenEntites.$instance, this.getNormalizedEntityName(entity), this.getEntityMetadata(entity));
                    }
                }
            }
        });

        // filter entities that were covered by this composite entity
        for (let i: number = 0; i < entities.length; i++) {
            if (!coveredSet.has(i)) {
                filteredEntities.push(entities[i]);
            }
        }

        this.addProperty(entitiesAndMetadata, this.getNormalizedEntityName(compositeEntityMetadata), childrenEntites);
        if (verbose) {
            this.addProperty(entitiesAndMetadata.$instance, this.getNormalizedEntityName(compositeEntityMetadata), childrenEntitiesMetadata);
        }

        return filteredEntities;
    }

    /**
     * If a property doesn't exist add it to a new array, otherwise append it to the existing array
     * @param obj Object on which the property is to be set
     * @param key Property Key
     * @param value Property Value
     */
    private addProperty(obj: any, key: string, value: any): void {
        if (key in obj) {
            obj[key] = obj[key].concat(value);
        } else {
            obj[key] = [value];
        }
    }

    private getSentiment(luis: LuisModels.LuisResult): any {
        let result: any;
        if (luis.sentimentAnalysis) {
            result = {
                label: luis.sentimentAnalysis.label,
                score: luis.sentimentAnalysis.score
            };
        }

        return result;
    }
}