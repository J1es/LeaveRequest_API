export class Validation{

    public static readonly ERROR_END_DATE_BEFORE_START_DATE = (startDate: string, endDate:string) => 
    `End date of ${endDate} is before the start date of ${startDate}`;
    
    public static validateDates(startDate:Date, endDate:Date) {
        if(startDate > endDate)
        {
            throw new Error(Validation.ERROR_END_DATE_BEFORE_START_DATE(startDate.toDateString(),endDate.toDateString()));
        }
    }

    public static daysBetween(start: Date, end: Date): number {
    const startUTC = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
    const endUTC = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());

    return Math.floor((endUTC - startUTC) / 86400000) + 1;
    }

}