import { z } from 'zod';
import { TableDefinition, TableColumns } from '../table';
export declare function generateSelectSchema<TCols extends TableColumns>(table: TableDefinition<TCols>): z.ZodObject<any>;
export declare function generateInsertSchema<TCols extends TableColumns>(table: TableDefinition<TCols>): z.ZodObject<any>;
