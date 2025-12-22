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

        // Performance Optimization
        // Detect if we should use Binary format for large queries
        // Threshold: 100k rows (based on LIMIT in SQL)
        const limitMatch = this.sql.match(/LIMIT\s+(\d+)/i);
        const limit = limitMatch ? parseInt(limitMatch[1], 10) : Infinity;

        const useBinary = limit >= 100000 && this.columnTypes.length > 0;

        if (useBinary) {
            const resultSet = await this.client.query({
                query: this.sql,
                query_params,
                format: 'RowBinary',
            });

            // Use BinaryReader for ultra-fast decoding
            const { BinaryReader, createBinaryDecoder } = await import('../utils/binary-reader');
            const response = await resultSet.stream();

            const decoder = this.columnTypes.map(type => createBinaryDecoder(type));
            const results: TResult[] = [];

            // RowBinary doesn't have blocks, it's a raw stream of rows
            // For now, we collect the whole buffer. For even larger queries, we'd use stream processing.
            const chunks: Buffer[] = [];
            for await (const chunk of response) {
                chunks.push(chunk as Buffer);
            }
            const fullBuffer = Buffer.concat(chunks);
            const reader = new BinaryReader(fullBuffer);

            while (!reader.isEOF()) {
                const row: any = {};
                for (let i = 0; i < this.columnNames.length; i++) {
                    row[this.columnNames[i]] = decoder[i](reader);
                }
                results.push(row as TResult);
            }

            return results;
        }

        const resultSet = await this.client.query({
            query: this.sql,
            query_params,
            format: 'JSONEachRow',
        });

        return resultSet.json();
    }
}
