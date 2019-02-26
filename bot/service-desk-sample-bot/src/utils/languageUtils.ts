export class LanguageUtils {
    public static isSingular(queryText: string): boolean {
        return !this.isPlural(queryText);
    }

    public static isPlural(queryText: string): boolean {
        //TODO: alterar para verificar o idioma  
        return queryText.match(/chamados|tickets/) != null;
    } 
}
