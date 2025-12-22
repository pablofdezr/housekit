export declare class PreparedQuery<TResult> {
    private client;
    readonly sql: string;
    private paramKeys;
    private querySuggestions;
    private columnNames;
    private columnTypes;
    constructor(client: any, sql: string, paramKeys: string[], // The order of parameters (p_1, p_2...)
    querySuggestions: string[], columnNames?: string[], columnTypes?: string[]);
    execute(values: any[]): Promise<TResult[]>;
}
