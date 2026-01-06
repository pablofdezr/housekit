export class PreparedQuery<TResult> {
    constructor(
        private client: any,
        public readonly sql: string,
        private paramKeys: string[], // The order of parameters (p_1, p_2...)
        private querySuggestions: string[],
        private columnNames: string[] = [],
        private columnTypes: string[] = []
    ) { }

    async execute(values: any[]): Promise<TResult[]> {
        // Map positional values to named parameters object { p_1: val1, p_2: val2... }
        const query_params: Record<string, any> = {};
        for (let i = 0; i < this.paramKeys.length; i++) {
            if (i < values.length) {
                query_params[this.paramKeys[i]] = values[i];
            }
        }

        // Note: RowBinary optimization disabled because @clickhouse/client 1.15+
        // doesn't support streaming with RowBinary format.
        // Always use JSONEachRow which is well-optimized by the official client.

        const resultSet = await this.client.query({
            query: this.sql,
            query_params,
            format: 'JSONEachRow',
        });

        return resultSet.json();
    }
}
