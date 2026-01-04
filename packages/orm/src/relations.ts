import type { ClickHouseColumn, RelationDefinition, TableColumns, TableDefinition } from './core';

type OneConfig = {
    fields: ClickHouseColumn[];
    references: ClickHouseColumn[];
};

type ManyConfig = {
    fields?: ClickHouseColumn[];
    references?: ClickHouseColumn[];
};

type RelationBuilderHelpers = {
    one: <TTarget extends TableDefinition<TableColumns>>(table: TTarget, config: OneConfig) => RelationDefinition<TTarget>;
    many: <TTarget extends TableDefinition<TableColumns>>(table: TTarget, config?: ManyConfig) => RelationDefinition<TTarget>;
};

export function relations<
    TTable extends TableDefinition<TableColumns>,
    TRelations extends Record<string, RelationDefinition<any>>
>(
    table: TTable,
    callback: (helpers: RelationBuilderHelpers) => TRelations
): asserts table is TTable & { $relations: TRelations };
export function relations<
    TTable extends TableDefinition<TableColumns>,
    TRelations extends Record<string, RelationDefinition<any>>
>(
    table: TTable,
    callback: (helpers: RelationBuilderHelpers) => TRelations
): TRelations;
export function relations<
    TTable extends TableDefinition<TableColumns>,
    TRelations extends Record<string, RelationDefinition<any>>
>(
    table: TTable,
    callback: (helpers: RelationBuilderHelpers) => TRelations
): TRelations {
    const helpers: RelationBuilderHelpers = {
        one: <TTarget extends TableDefinition<TableColumns>>(relTable: TTarget, config: OneConfig): RelationDefinition<TTarget> => ({
            relation: 'one',
            name: relTable.$table,
            table: relTable,
            fields: config.fields,
            references: config.references
        }),
        many: <TTarget extends TableDefinition<TableColumns>>(relTable: TTarget, config: ManyConfig = {}): RelationDefinition<TTarget> => ({
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
