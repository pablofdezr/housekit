import { z } from 'zod';
import { TableDefinition, TableColumns } from '../table';
import { ClickHouseColumn } from '../column';

// Helper to map ClickHouse types to Zod types
function mapClickHouseTypeToZod(column: ClickHouseColumn): z.ZodTypeAny {
    const type = column.type.toLowerCase();
    let zodType: z.ZodTypeAny;

    if (type.startsWith('nullable(')) {
        const innerType = column.type.slice('nullable('.length, -1);
        const innerColumn = new ClickHouseColumn(column.name, innerType);
        zodType = mapClickHouseTypeToZod(innerColumn).nullable();
    } else if (type.startsWith('array(')) {
        const innerType = column.type.slice('array('.length, -1);
        const innerColumn = new ClickHouseColumn(column.name, innerType);
        zodType = z.array(mapClickHouseTypeToZod(innerColumn));
    } else if (type.startsWith('fixedstring')) {
        zodType = z.string(); // FixedString can be validated for length later if needed
    } else if (type.startsWith('enum')) {
        // Enums can be tricky. If enumValues exist, use them. Otherwise, default to string or number.
        if (column.meta?.enumValues) {
            zodType = z.enum(column.meta.enumValues as [string, ...string[]]);
        } else {
            zodType = z.string(); // Fallback if enum values not defined in meta
        }
    } else if (type.startsWith('datetime64')) {
        zodType = z.date(); // Date objects in JS for DateTime64
    } else if (type.startsWith('decimal')) {
        zodType = z.string().refine((val) => !isNaN(parseFloat(val)), {
            message: "Must be a valid decimal number string",
        }); // Represent as string to avoid precision issues
    }
    else {
        switch (type) {
            case 'uuid':
            case 'string':
            case 'json': // Assuming JSON is stored as string in ClickHouse
            case 'ipv4':
            case 'ipv6':
                zodType = z.string();
                break;
            case 'int8': case 'uint8': case 'int16': case 'uint16':
            case 'int32': case 'uint32': case 'float32': case 'float64':
                zodType = z.number();
                break;
            case 'int64': case 'uint64': case 'int128': case 'uint128':
            case 'int256': case 'uint256':
                zodType = z.bigint();
                break;
            case 'boolean':
            case 'bool':
                zodType = z.boolean();
                break;
            case 'date':
            case 'datetime':
                zodType = z.date(); // Represent as JS Date objects, not string
                break;
            default:
                // AGGRESSIVE: Default to string for unknown types to avoid z.any()
                // which would allow nulls. Developers must handle empty strings
                // instead of null.
                zodType = z.string();
                break;
        }
    }

    // Apply nullable status based on column metadata or Nullable(T) wrapper
    if (column.isNull && !type.startsWith('nullable(')) {
        zodType = zodType.nullable();
    }

    return zodType;
}

// Function to generate a Zod schema for a SELECT model (read-only)
export function generateSelectSchema<TCols extends TableColumns>(table: TableDefinition<TCols>): z.ZodObject<any> {
    const shape: Record<string, z.ZodTypeAny> = {};

    for (const key in table.$columns) {
        if (Object.prototype.hasOwnProperty.call(table.$columns, key)) {
            const column = table.$columns[key];
            shape[key] = mapClickHouseTypeToZod(column);
        }
    }

    return z.object(shape);
}

// Function to generate a Zod schema for an INSERT model (write-only)
export function generateInsertSchema<TCols extends TableColumns>(table: TableDefinition<TCols>): z.ZodObject<any> {
    const shape: Record<string, z.ZodTypeAny> = {};

    for (const key in table.$columns) {
        if (Object.prototype.hasOwnProperty.call(table.$columns, key)) {
            const column = table.$columns[key];
            let zodType = mapClickHouseTypeToZod(column);

            // If the column is NOT NULL but has a default or autoGenerate, it's optional for insert
            const isOptionalBySchema = !column.isNull && (column.meta?.default !== undefined || column.meta?.defaultFn !== undefined || column.meta?.defaultExpr !== undefined || column.meta?.autoGenerate !== undefined);

            // If the column is Nullable, it's optional
            const isOptionalByNullable = column.isNull;

            if (isOptionalBySchema || isOptionalByNullable) {
                zodType = zodType.optional();
            } else {
                // If not optional by schema or nullable, it's required.
                // But if type was nullable(), optional() is already added by mapClickHouseTypeToZod.
                // We just need to make sure if a non-nullable type has optional().
                // z.number().optional() === z.number().nullable() for Zod's perspective.
                // So, no extra step for required fields here, as it's implicit if not optional.
            }

            shape[key] = zodType;
        }
    }

    return z.object(shape);
}