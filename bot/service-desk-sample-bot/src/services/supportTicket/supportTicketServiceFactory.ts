import { SupportTicketService } from "./supportTicketService";
import { SupportKbService } from "./supportKbService";
import { QnAMakerFactory } from "../../cognitiveServices/qnaMakerFactory";
import { LuisRecognizerFactory } from "../../cognitiveServices/luisRecognizerFactory";

export class SupportTicketServiceFactory {

    public static getSupportTicketService() {
        return new SupportTicketService();
    }

    public static getSupportTicketKbService(
        luisRecognizerFactory: LuisRecognizerFactory, 
        qnaMakerFactory: QnAMakerFactory) {

        return new SupportKbService(
            luisRecognizerFactory, 
            qnaMakerFactory);
    }
}
