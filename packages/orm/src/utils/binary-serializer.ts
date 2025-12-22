import { v4 as uuidv4 } from 'uuid';

/**
 * HouseKit Binary Serializer - Ultra-Fast RowBinary Encoding
 * 
 * ClickHouse's RowBinary format sends data directly as bytes with no parsing overhead.
 * This is the fastest possible way to insert data into ClickHouse.
 * 
 * Benefits over JSONEachRow:
 * - No JSON.stringify() overhead
 * - No string escaping
 * - No parsing on ClickHouse side
 * - Smaller payload (Int64 = 8 bytes vs up to 20 bytes as string)
 * - Lower GC pressure (no intermediate strings)
 */

// ============================================================================
// Binary Writer - Low-Level Buffer Operations
// ============================================================================

/**
 * Efficient binary buffer writer that minimizes allocations.
 * Uses a pre-allocated buffer that grows as needed.
 */
export class BinaryWriter {
    private buffer: Buffer;
    private offset: number = 0;

    constructor(initialSize: number = 4096) {
        this.buffer = Buffer.allocUnsafe(initialSize);
    }

    /**
     * Ensure buffer has enough space for n more bytes
     */
    private ensureCapacity(bytes: number): void {
        const required = this.offset + bytes;
        if (required > this.buffer.length) {
            // Grow buffer by 2x or to required size, whichever is larger
            const newSize = Math.max(this.buffer.length * 2, required);
            const newBuffer = Buffer.allocUnsafe(newSize);
            this.buffer.copy(newBuffer, 0, 0, this.offset);
            this.buffer = newBuffer;
        }
    }

    /**
     * Reset the writer for reuse (avoids allocating new buffer)
     */
    reset(): void {
        this.offset = 0;
    }

    /**
     * Get the final buffer with only written bytes
     */
    getBuffer(): Buffer {
        return this.buffer.subarray(0, this.offset);
    }

    /**
     * Get a copy of the buffer (safe to use after reset)
     */
    toBuffer(): Buffer {
        return Buffer.from(this.buffer.subarray(0, this.offset));
    }

    // =========================================================================
    // Integer Types (Little Endian)
    // =========================================================================

    writeInt8(value: number): void {
        this.ensureCapacity(1);
        this.buffer.writeInt8(value, this.offset);
        this.offset += 1;
    }

    writeUInt8(value: number): void {
        this.ensureCapacity(1);
        this.buffer.writeUInt8(value, this.offset);
        this.offset += 1;
    }

    writeInt16(value: number): void {
        this.ensureCapacity(2);
        this.buffer.writeInt16LE(value, this.offset);
        this.offset += 2;
    }

    writeUInt16(value: number): void {
        this.ensureCapacity(2);
        this.buffer.writeUInt16LE(value, this.offset);
        this.offset += 2;
    }

    writeInt32(value: number): void {
        this.ensureCapacity(4);
        this.buffer.writeInt32LE(value, this.offset);
        this.offset += 4;
    }

    writeUInt32(value: number): void {
        this.ensureCapacity(4);
        this.buffer.writeUInt32LE(value, this.offset);
        this.offset += 4;
    }

    writeInt64(value: bigint | number): void {
        this.ensureCapacity(8);
        this.buffer.writeBigInt64LE(BigInt(value), this.offset);
        this.offset += 8;
    }

    writeUInt64(value: bigint | number): void {
        this.ensureCapacity(8);
        this.buffer.writeBigUInt64LE(BigInt(value), this.offset);
        this.offset += 8;
    }

    writeInt128(value: bigint): void {
        this.ensureCapacity(16);
        // Little endian: low 64 bits first, then high 64 bits
        const low = value & BigInt('0xFFFFFFFFFFFFFFFF');
        const high = value >> BigInt(64);
        this.buffer.writeBigUInt64LE(low, this.offset);
        this.buffer.writeBigInt64LE(high, this.offset + 8);
        this.offset += 16;
    }

    writeUInt128(value: bigint): void {
        this.ensureCapacity(16);
        const low = value & BigInt('0xFFFFFFFFFFFFFFFF');
        const high = value >> BigInt(64);
        this.buffer.writeBigUInt64LE(low, this.offset);
        this.buffer.writeBigUInt64LE(high, this.offset + 8);
        this.offset += 16;
    }

    writeInt256(value: bigint): void {
        this.ensureCapacity(32);
        // Write as 4 x 64-bit words in little endian
        for (let i = 0; i < 4; i++) {
            const word = value & BigInt('0xFFFFFFFFFFFFFFFF');
            this.buffer.writeBigUInt64LE(word, this.offset + i * 8);
            value >>= BigInt(64);
        }
        this.offset += 32;
    }

    writeUInt256(value: bigint): void {
        this.writeInt256(value); // Same encoding for unsigned
    }

    // =========================================================================
    // Floating Point Types
    // =========================================================================

    writeFloat32(value: number): void {
        this.ensureCapacity(4);
        this.buffer.writeFloatLE(value, this.offset);
        this.offset += 4;
    }

    writeFloat64(value: number): void {
        this.ensureCapacity(8);
        this.buffer.writeDoubleLE(value, this.offset);
        this.offset += 8;
    }

    // =========================================================================
    // Variable Length Integer (LEB128)
    // =========================================================================

    /**
     * Write a variable-length integer (LEB128).
     * Used for string lengths in RowBinary format.
     */
    writeVarInt(value: number): void {
        // Pre-calculate size (most values are small)
        if (value < 0x80) {
            this.ensureCapacity(1);
            this.buffer[this.offset++] = value;
            return;
        }
        if (value < 0x4000) {
            this.ensureCapacity(2);
            this.buffer[this.offset++] = (value & 0x7f) | 0x80;
            this.buffer[this.offset++] = value >> 7;
            return;
        }
        if (value < 0x200000) {
            this.ensureCapacity(3);
            this.buffer[this.offset++] = (value & 0x7f) | 0x80;
            this.buffer[this.offset++] = ((value >> 7) & 0x7f) | 0x80;
            this.buffer[this.offset++] = value >> 14;
            return;
        }

        // General case for larger values
        this.ensureCapacity(10); // Max 10 bytes for 64-bit
        while (value >= 0x80) {
            this.buffer[this.offset++] = (value & 0x7f) | 0x80;
            value >>>= 7;
        }
        this.buffer[this.offset++] = value;
    }

    // =========================================================================
    // String Types
    // =========================================================================

    /**
     * Write a string in RowBinary format: [VarInt length][UTF-8 bytes]
     */
    writeString(value: string): void {
        const strBuffer = Buffer.from(value, 'utf-8');
        this.writeVarInt(strBuffer.length);
        this.ensureCapacity(strBuffer.length);
        strBuffer.copy(this.buffer, this.offset);
        this.offset += strBuffer.length;
    }

    /**
     * Write a FixedString(N) - padded with null bytes if shorter
     */
    writeFixedString(value: string, length: number): void {
        this.ensureCapacity(length);
        const strBuffer = Buffer.from(value, 'utf-8');
        const copyLen = Math.min(strBuffer.length, length);
        strBuffer.copy(this.buffer, this.offset, 0, copyLen);
        // Pad with zeros if needed
        if (copyLen < length) {
            this.buffer.fill(0, this.offset + copyLen, this.offset + length);
        }
        this.offset += length;
    }

    /**
     * Write raw bytes directly
     */
    writeBytes(data: Buffer): void {
        this.ensureCapacity(data.length);
        data.copy(this.buffer, this.offset);
        this.offset += data.length;
    }

    // =========================================================================
    // UUID Type
    // =========================================================================

    /**
     * Write a UUID (16 bytes).
     * ClickHouse stores UUIDs as two UInt64 in big-endian order!
     * This is different from the usual little-endian storage.
     */
    writeUUID(value: string): void {
        this.ensureCapacity(16);
        // Remove dashes and parse as hex
        const hex = value.replace(/-/g, '');
        if (hex.length !== 32) {
            throw new Error(`Invalid UUID: ${value}`);
        }
        // UUID is stored as two 64-bit integers in big-endian
        // But each integer is stored in little-endian byte order
        // So we need to reverse each 8-byte group
        const bytes = Buffer.from(hex, 'hex');
        // First 8 bytes (big-endian) -> reverse to little-endian
        for (let i = 7; i >= 0; i--) {
            this.buffer[this.offset++] = bytes[i];
        }
        // Second 8 bytes (big-endian) -> reverse to little-endian
        for (let i = 15; i >= 8; i--) {
            this.buffer[this.offset++] = bytes[i];
        }
    }

    // =========================================================================
    // Date/Time Types
    // =========================================================================

    /**
     * Write a Date (days since epoch as UInt16)
     */
    writeDate(value: Date | number): void {
        const days = typeof value === 'number'
            ? value
            : Math.floor(value.getTime() / (1000 * 60 * 60 * 24));
        this.writeUInt16(days);
    }

    /**
     * Write a Date32 (days since epoch as Int32)
     */
    writeDate32(value: Date | number): void {
        const days = typeof value === 'number'
            ? value
            : Math.floor(value.getTime() / (1000 * 60 * 60 * 24));
        this.writeInt32(days);
    }

    /**
     * Write a DateTime (seconds since epoch as UInt32)
     */
    writeDateTime(value: Date | number): void {
        const seconds = typeof value === 'number'
            ? value
            : Math.floor(value.getTime() / 1000);
        this.writeUInt32(seconds);
    }

    /**
     * Write a DateTime64 with specified precision
     */
    writeDateTime64(value: Date | number, precision: number = 3): void {
        const multiplier = Math.pow(10, precision);
        const ticks = typeof value === 'number'
            ? BigInt(Math.round(value * multiplier))
            : BigInt(Math.round(value.getTime() * multiplier / 1000));
        this.writeInt64(ticks);
    }

    // =========================================================================
    // Nullable Types
    // =========================================================================

    /**
     * Write a nullable prefix (0 = not null, 1 = null)
     */
    writeNullable(isNull: boolean): void {
        this.writeUInt8(isNull ? 1 : 0);
    }

    // =========================================================================
    // Array Types
    // =========================================================================

    /**
     * Write array length prefix
     */
    writeArrayLength(length: number): void {
        this.writeUInt64(length);
    }

    // =========================================================================
    // Decimal Types
    // =========================================================================

    /**
     * Write Decimal32 (stored as Int32)
     */
    writeDecimal32(value: number, scale: number): void {
        const scaled = Math.round(value * Math.pow(10, scale));
        this.writeInt32(scaled);
    }

    /**
     * Write Decimal64 (stored as Int64)
     */
    writeDecimal64(value: number, scale: number): void {
        const scaled = BigInt(Math.round(value * Math.pow(10, scale)));
        this.writeInt64(scaled);
    }

    /**
     * Write Decimal128 (stored as Int128)
     */
    writeDecimal128(value: number | bigint, scale: number): void {
        let scaled: bigint;
        if (typeof value === 'bigint') {
            scaled = value * BigInt(Math.pow(10, scale));
        } else {
            scaled = BigInt(Math.round(value * Math.pow(10, scale)));
        }
        this.writeInt128(scaled);
    }

    // =========================================================================
    // Boolean Type
    // =========================================================================

    writeBool(value: boolean): void {
        this.writeUInt8(value ? 1 : 0);
    }

    // =========================================================================
    // IPv4/IPv6 Types
    // =========================================================================

    /**
     * Write IPv4 address (UInt32 in network byte order)
     */
    writeIPv4(value: string | number): void {
        if (typeof value === 'number') {
            this.writeUInt32(value);
            return;
        }
        const parts = value.split('.').map(Number);
        if (parts.length !== 4) {
            throw new Error(`Invalid IPv4: ${value}`);
        }
        // Network byte order (big-endian), but stored as UInt32 LE
        const num = (parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3];
        this.writeUInt32(num >>> 0); // Ensure unsigned
    }

    /**
     * Write IPv6 address (16 bytes)
     */
    writeIPv6(value: string | Buffer): void {
        if (Buffer.isBuffer(value)) {
            if (value.length !== 16) {
                throw new Error('IPv6 must be 16 bytes');
            }
            this.writeBytes(value);
            return;
        }
        // Parse IPv6 string
        const expanded = this.expandIPv6(value);
        const parts = expanded.split(':');
        this.ensureCapacity(16);
        for (const part of parts) {
            const num = parseInt(part, 16);
            this.buffer.writeUInt16BE(num, this.offset);
            this.offset += 2;
        }
    }

    private expandIPv6(ip: string): string {
        // Handle :: expansion
        const parts = ip.split('::');
        if (parts.length === 1) {
            return ip;
        }
        const left = parts[0] ? parts[0].split(':') : [];
        const right = parts[1] ? parts[1].split(':') : [];
        const missing = 8 - left.length - right.length;
        const middle = Array(missing).fill('0000');
        return [...left, ...middle, ...right].map(p => p.padStart(4, '0')).join(':');
    }

    // =========================================================================
    // Enum Types
    // =========================================================================

    writeEnum8(value: number): void {
        this.writeInt8(value);
    }

    writeEnum16(value: number): void {
        this.writeInt16(value);
    }
}

// ============================================================================
// Type-Specific Encoders
// ============================================================================

export type BinaryEncoder = (writer: BinaryWriter, value: any) => void;

/**
 * Split a type string into arguments, handling nested parentheses.
 * e.g. "String, Array(Int32)" -> ["String", "Array(Int32)"]
 */
function parseGenericTypes(typeString: string): string[] {
    const args: string[] = [];
    let current = '';
    let parenDepth = 0;

    for (let i = 0; i < typeString.length; i++) {
        const char = typeString[i];
        if (char === ',' && parenDepth === 0) {
            args.push(current.trim());
            current = '';
        } else {
            if (char === '(') parenDepth++;
            if (char === ')') parenDepth--;
            current += char;
        }
    }
    if (current.trim()) {
        args.push(current.trim());
    }
    return args;
}

/**
 * Create a binary encoder for a ClickHouse column type
 */
export function createBinaryEncoder(clickhouseType: string, isNullable: boolean = false): BinaryEncoder {
    const type = clickhouseType.toLowerCase().trim();

    // Extract inner type for Nullable
    const nullableMatch = type.match(/^nullable\((.+)\)$/);
    if (nullableMatch) {
        const innerEncoder = createBinaryEncoder(nullableMatch[1], false);
        return (writer: BinaryWriter, value: any) => {
            if (value === null || value === undefined) {
                writer.writeNullable(true);
            } else {
                writer.writeNullable(false);
                innerEncoder(writer, value);
            }
        };
    }

    // Handle Array types
    const arrayMatch = type.match(/^array\((.+)\)$/);
    if (arrayMatch) {
        const elementEncoder = createBinaryEncoder(arrayMatch[1], false);
        return (writer: BinaryWriter, value: any) => {
            const arr = Array.isArray(value) ? value : [];
            writer.writeArrayLength(arr.length);
            for (const item of arr) {
                elementEncoder(writer, item);
            }
        };
    }

    // Handle Map(Key, Value)
    const mapMatch = type.match(/^map\((.+)\)$/);
    if (mapMatch) {
        const [keyType, valueType] = parseGenericTypes(mapMatch[1]);
        if (!keyType || !valueType) throw new Error(`Invalid Map type: ${type}`);

        const keyEncoder = createBinaryEncoder(keyType);
        const valueEncoder = createBinaryEncoder(valueType);

        return (writer: BinaryWriter, value: any) => {
            // Map input can be object or array of entries?
            // Assuming object for now, or Map
            let entries: [any, any][];
            if (value instanceof Map) {
                entries = Array.from(value.entries());
            } else if (typeof value === 'object' && value !== null) {
                entries = Object.entries(value);
            } else {
                entries = [];
            }

            writer.writeUInt64(entries.length);
            for (const [k, v] of entries) {
                keyEncoder(writer, k);
                valueEncoder(writer, v);
            }
        };
    }

    // Handle Tuple(T1, T2, ...)
    const tupleMatch = type.match(/^tuple\((.+)\)$/);
    if (tupleMatch) {
        const types = parseGenericTypes(tupleMatch[1]);
        const encoders = types.map(t => createBinaryEncoder(t));

        return (writer: BinaryWriter, value: any) => {
            const arr = Array.isArray(value) ? value : [];
            // Tuple must match length exactly strictly speaking, but we'll try best effort
            for (let i = 0; i < encoders.length; i++) {
                encoders[i](writer, arr[i]);
            }
        };
    }

    // Handle Nested(N1 T1, N2 T2, ...) -> Treated as Array(Tuple(T1, T2, ...))
    // Note: The definition in data-types.ts is Nested(name1 type1, name2 type2)
    // which results in a string "Nested(name1 type1, name2 type2)"
    const nestedMatch = type.match(/^nested\((.+)\)$/);
    if (nestedMatch) {
        // Parse fields: "id Int32, name String"
        const fields = parseGenericTypes(nestedMatch[1]);
        // Each field is "name Type"
        const types = fields.map(f => {
            const parts = f.trim().split(/\s+/);
            if (parts.length < 2) return 'String'; // Fallback
            // Join rest in case type has spaces (e.g. FixedString(10))
            return parts.slice(1).join(' ');
        });

        // Create a Tuple encoder for the row structure
        // We construct a fake "Tuple(T1, T2)" type
        const tupleType = `Tuple(${types.join(', ')})`;
        const tupleEncoder = createBinaryEncoder(tupleType);

        // Nested acts like Array(Tuple(...))
        return (writer: BinaryWriter, value: any) => {
            const arr = Array.isArray(value) ? value : [];
            writer.writeArrayLength(arr.length);
            for (const item of arr) {
                // If item is object {id: 1, name: 'a'}, convert to tuple array [1, 'a']
                // We need to know field names to map object to tuple array?
                // Yes. 
                // Optimization: Pre-calculate field names
                let tupleValue = item;
                if (!Array.isArray(item) && typeof item === 'object') {
                    tupleValue = fields.map(f => {
                        const name = f.trim().split(/\s+/)[0];
                        return item[name];
                    });
                }
                tupleEncoder(writer, tupleValue);
            }
        };
    }

    // Handle LowCardinality(T) -> Fallback to T
    // RowBinary doesn't support raw values for LowCardinality easily, 
    // but we can try encoding as T and hope the server or configured format accepts it.
    // If not, at least we tried properly instead of string.
    const lcMatch = type.match(/^lowcardinality\((.+)\)$/);
    if (lcMatch) {
        return createBinaryEncoder(lcMatch[1]);
    }

    // Handle FixedString(N)
    const fixedStringMatch = type.match(/^fixedstring\((\d+)\)$/);
    if (fixedStringMatch) {
        const length = parseInt(fixedStringMatch[1], 10);
        return (writer: BinaryWriter, value: any) => {
            writer.writeFixedString(String(value ?? ''), length);
        };
    }

    // Handle Decimal types
    const decimalMatch = type.match(/^decimal(?:32|64|128)?\((\d+),\s*(\d+)\)$/);
    if (decimalMatch) {
        const scale = parseInt(decimalMatch[2], 10);
        if (type.includes('decimal128')) {
            return (writer: BinaryWriter, value: any) => writer.writeDecimal128(value, scale);
        }
        if (type.includes('decimal64')) {
            return (writer: BinaryWriter, value: any) => writer.writeDecimal64(value, scale);
        }
        return (writer: BinaryWriter, value: any) => writer.writeDecimal32(value, scale);
    }

    // Handle DateTime64 with precision
    const dt64Match = type.match(/^datetime64\((\d+)/);
    if (dt64Match) {
        const precision = parseInt(dt64Match[1], 10);
        return (writer: BinaryWriter, value: any) => writer.writeDateTime64(value, precision);
    }

    // Handle Enum types
    const enum8Match = type.match(/^enum8\(/);
    if (enum8Match) {
        return (writer: BinaryWriter, value: any) => writer.writeEnum8(Number(value));
    }
    const enum16Match = type.match(/^enum16\(/);
    if (enum16Match) {
        return (writer: BinaryWriter, value: any) => writer.writeEnum16(Number(value));
    }

    // Base types
    const baseEncoder = getBaseTypeEncoder(type);

    if (isNullable) {
        return (writer: BinaryWriter, value: any) => {
            if (value === null || value === undefined) {
                writer.writeNullable(true);
            } else {
                writer.writeNullable(false);
                baseEncoder(writer, value);
            }
        };
    }

    // Special handling for UUID auto-generation if not nullable
    if (type === 'uuid') {
        return (writer: BinaryWriter, value: any) => {
            if (value === undefined || value === null) {
                // Auto-generate UUIDv4
                baseEncoder(writer, uuidv4());
            } else {
                baseEncoder(writer, value);
            }
        };
    }

    return baseEncoder;
}

function getBaseTypeEncoder(type: string): BinaryEncoder {
    // Integer types
    if (type === 'int8') return (w, v) => w.writeInt8(Number(v));
    if (type === 'uint8') return (w, v) => w.writeUInt8(Number(v));
    if (type === 'int16') return (w, v) => w.writeInt16(Number(v));
    if (type === 'uint16') return (w, v) => w.writeUInt16(Number(v));
    if (type === 'int32') return (w, v) => w.writeInt32(Number(v));
    if (type === 'uint32') return (w, v) => w.writeUInt32(Number(v));
    if (type === 'int64') return (w, v) => w.writeInt64(v);
    if (type === 'uint64') return (w, v) => w.writeUInt64(v);
    if (type === 'int128') return (w, v) => w.writeInt128(BigInt(v));
    if (type === 'uint128') return (w, v) => w.writeUInt128(BigInt(v));
    if (type === 'int256') return (w, v) => w.writeInt256(BigInt(v));
    if (type === 'uint256') return (w, v) => w.writeUInt256(BigInt(v));

    // Floating point
    if (type === 'float32') return (w, v) => w.writeFloat32(Number(v));
    if (type === 'float64') return (w, v) => w.writeFloat64(Number(v));

    // String types
    if (type === 'string') return (w, v) => w.writeString(String(v ?? ''));

    // UUID
    if (type === 'uuid') return (w, v) => w.writeUUID(String(v));

    // Date/Time types
    if (type === 'date') return (w, v) => w.writeDate(v);
    if (type === 'date32') return (w, v) => w.writeDate32(v);
    if (type === 'datetime') return (w, v) => w.writeDateTime(v);
    if (type.startsWith('datetime64')) return (w, v) => w.writeDateTime64(v, 3);

    // Boolean
    if (type === 'bool' || type === 'boolean') return (w, v) => w.writeBool(Boolean(v));

    // IP addresses
    if (type === 'ipv4') return (w, v) => w.writeIPv4(v);
    if (type === 'ipv6') return (w, v) => w.writeIPv6(v);

    // Default: treat as string
    return (w, v) => w.writeString(String(v ?? ''));
}

// ============================================================================
// Batch Serialization
// ============================================================================

/**
 * Configuration for binary serialization
 */
export interface BinarySerializationConfig {
    /** Column names in order */
    columns: Array<{
        name: string;
        type: string;
        isNullable: boolean;
    }>;
    /** Property key mapping (propKey -> column index) */
    keyMapping: Map<string, number>;
    /** Pre-compiled encoders for each column */
    encoders: BinaryEncoder[];
}

/**
 * Build a binary serialization configuration from a table definition
 */
export function buildBinaryConfig(columns: Array<{ name: string; type: string; isNull: boolean; propKey: string }>): BinarySerializationConfig {
    const keyMapping = new Map<string, number>();
    const encoders: BinaryEncoder[] = [];
    const columnInfos: BinarySerializationConfig['columns'] = [];

    columns.forEach((col, index) => {
        keyMapping.set(col.propKey, index);
        keyMapping.set(col.name, index);
        encoders.push(createBinaryEncoder(col.type, col.isNull));
        columnInfos.push({
            name: col.name,
            type: col.type,
            isNullable: col.isNull,
        });
    });

    return { columns: columnInfos, keyMapping, encoders };
}

/**
 * Serialize a single row to RowBinary format
 */
export function serializeRowBinary(
    row: Record<string, any>,
    config: BinarySerializationConfig,
    writer: BinaryWriter = new BinaryWriter()
): Buffer {
    writer.reset();

    for (let i = 0; i < config.columns.length; i++) {
        const col = config.columns[i];
        const value = row[col.name];
        config.encoders[i](writer, value);
    }

    return writer.toBuffer();
}

/**
 * Serialize multiple rows to a single RowBinary buffer
 */
export function serializeRowsBinary(
    rows: Array<Record<string, any>>,
    config: BinarySerializationConfig
): Buffer {
    // Pre-calculate approximate size
    const estimatedRowSize = config.columns.length * 16; // Rough estimate
    const writer = new BinaryWriter(rows.length * estimatedRowSize);

    for (const row of rows) {
        for (let i = 0; i < config.columns.length; i++) {
            const col = config.columns[i];
            const value = row[col.name];
            config.encoders[i](writer, value);
        }
    }

    return writer.toBuffer();
}
