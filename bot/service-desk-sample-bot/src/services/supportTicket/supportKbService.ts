import { LuisRecognizer, QnAMaker, QnAMakerResult } from "botbuilder-ai";
import { QnAMakerFactory } from "../../cognitiveServices/qnaMakerFactory";
import { LuisRecognizerFactory } from "../../cognitiveServices/luisRecognizerFactory";
import { LogFactory } from "../../utils/logger";
import { TurnContext } from "botbuilder";
import { TextLuisRecognizer } from "../../utils/luisTextRecognizer";

const SUPPORT_KBS_DISPATCH_LUIS_CONFIG_NAME = 'ServiceDeskSampleBot_support_kbs_dispatch';
const QNA_KB_PRINTER_ISSUES = 'qna_kb_printer_issues';
const QNA_KB_PC_LAPTOP_ISSUES = 'qna_kb_pc_and_laptop_issues';

const log = LogFactory.getLogger("SupportKb");

const Q_KB_PC_AND_LAPTOP_ISSUES = 'q_kb_pc_and_laptop_issues';
const Q_KB_PRINTER_ISSUES = 'q_kb_printer_issues';

export class SupportKbService {

    private supportKbsDispatchRecognizer: TextLuisRecognizer;
    private qnaKbPcLaptopIssues: QnAMaker;
    private qnaKbPrinterIssues: QnAMaker;

    constructor(
        private luisRecognizerFactory: LuisRecognizerFactory,
        private qnaMakerFactory: QnAMakerFactory) {

        this.supportKbsDispatchRecognizer = this.luisRecognizerFactory.getTextLuisRecognizer(SUPPORT_KBS_DISPATCH_LUIS_CONFIG_NAME);
        this.qnaKbPcLaptopIssues = this.qnaMakerFactory.getQnAMaker(QNA_KB_PC_LAPTOP_ISSUES);
        this.qnaKbPrinterIssues = this.qnaMakerFactory.getQnAMaker(QNA_KB_PRINTER_ISSUES);
    }

    /**
     * Search knowledge base for answers for the returned problem
     * 
     * @param problem Problem statement
     */
    async searchForAnswers(problem: string, context: TurnContext, top: number): Promise<Answer[]> {

        const dispatchResults = await this.supportKbsDispatchRecognizer.recognize(problem);
        const dispatchTopIntent = LuisRecognizer.topIntent(dispatchResults);

        log.debug(`Support KB dispatch top intent: ${dispatchTopIntent}`);

        let answers: QnAMakerResult[] = null;

        switch (dispatchTopIntent) {
            case Q_KB_PC_AND_LAPTOP_ISSUES:
                answers = await this.qnaKbPcLaptopIssues.generateAnswer(problem, top);
                return this.toAnswers(answers);
            case Q_KB_PRINTER_ISSUES:
                answers = await this.qnaKbPrinterIssues.generateAnswer(problem, top);
                return this.toAnswers(answers);
            default:
                return null;
        }
    }

    private toAnswers(results: QnAMakerResult[]): Answer[] {
        if (results == null || results.length == 0) {
            return null;
        } else {
            let answers: Answer[] = [];
            results.forEach(element => {
                let answer = new Answer();
                answer.text = element.answer;
                answer.score = element.score;
                answer.id = element.id;
                answers.push(answer);
            });

            return answers;
        }
    }
}

export class Answer {
    public id: number;
    public text: string;
    public score: number;
}