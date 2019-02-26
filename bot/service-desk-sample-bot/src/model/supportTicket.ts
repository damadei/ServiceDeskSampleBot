export class SupportTicket {
    public static STATUS_OPEN = 0;
    public static STATUS_CLOSED = 99;

    public id: string;
    public userId: string;
    public openDate: Date;
    public status: number;
    public statusDescription: string;
    public description: string;
    public lastUpdate: Date;
}