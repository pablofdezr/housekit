import type { ClickHouseColumn, RelationDefinition, TableDefinition } from './core';

type OneConfig = {
    fields: ClickHouseColumn[];
    references: ClickHouseColumn[];
};

type ManyConfig = {
    fields?: ClickHouseColumn[];
    references?: ClickHouseColumn[];
};

type RelationBuilderHelpers = {
    one: (table: TableDefinition<any>, config: OneConfig) => RelationDefinition;
    many: (table: TableDefinition<any>, config?: ManyConfig) => RelationDefinition;
};

export function relations<TTable extends TableDefinition<any>, TRelations extends Record<string, RelationDefinition>>(
    table: TTable,
    callback: (helpers: RelationBuilderHelpers) => TRelations
): TRelations {
    const helpers: RelationBuilderHelpers = {
        one: (relTable, config) => ({
            relation: 'one',
            name: relTable.$table,
            table: relTable,
            fields: config.fields,
            references: config.references
        }),
        many: (relTable, config = {}) => ({
            relation: 'many',
            name: relTable.$table,
            table: relTable,
            fields: config.fields,
            references: config.references
        })
    };

    const defs = callback(helpers);
    (table as any).$relations = defs;
    return defs;
}
