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
/**
 * Efficient binary buffer writer that minimizes allocations.
 * Uses a pre-allocated buffer that grows as needed.
 */
export declare class BinaryWriter {
    private buffer;
    private offset;
    constructor(initialSize?: number);
    /**
     * Ensure buffer has enough space for n more bytes
     */
    private ensureCapacity;
    /**
     * Reset the writer for reuse (avoids allocating new buffer)
     */
    reset(): void;
    /**
     * Get the final buffer with only written bytes
     */
    getBuffer(): Buffer;
    /**
     * Get a copy of the buffer (safe to use after reset)
     */
    toBuffer(): Buffer;
    writeInt8(value: number): void;
    writeUInt8(value: number): void;
    writeInt16(value: number): void;
    writeUInt16(value: number): void;
    writeInt32(value: number): void;
    writeUInt32(value: number): void;
    writeInt64(value: bigint | number): void;
    writeUInt64(value: bigint | number): void;
    writeInt128(value: bigint): void;
    writeUInt128(value: bigint): void;
    writeInt256(value: bigint): void;
    writeUInt256(value: bigint): void;
    writeFloat32(value: number): void;
    writeFloat64(value: number): void;
    /**
     * Write a variable-length integer (LEB128).
     * Used for string lengths in RowBinary format.
     */
    writeVarInt(value: number): void;
    /**
     * Write a string in RowBinary format: [VarInt length][UTF-8 bytes]
     */
    writeString(value: string): void;
    /**
     * Write a FixedString(N) - padded with null bytes if shorter
     */
    writeFixedString(value: string, length: number): void;
    /**
     * Write raw bytes directly
     */
    writeBytes(data: Buffer): void;
    /**
     * Write a UUID (16 bytes).
     * ClickHouse stores UUIDs as two UInt64 in big-endian order!
     * This is different from the usual little-endian storage.
     */
    writeUUID(value: string): void;
    /**
     * Write a Date (days since epoch as UInt16)
     */
    writeDate(value: Date | number): void;
    /**
     * Write a Date32 (days since epoch as Int32)
     */
    writeDate32(value: Date | number): void;
    /**
     * Write a DateTime (seconds since epoch as UInt32)
     */
    writeDateTime(value: Date | number): void;
    /**
     * Write a DateTime64 with specified precision
     */
    writeDateTime64(value: Date | number, precision?: number): void;
    /**
     * Write a nullable prefix (0 = not null, 1 = null)
     */
    writeNullable(isNull: boolean): void;
    /**
     * Write array length prefix
     */
    writeArrayLength(length: number): void;
    /**
     * Write Decimal32 (stored as Int32)
     */
    writeDecimal32(value: number, scale: number): void;
    /**
     * Write Decimal64 (stored as Int64)
     */
    writeDecimal64(value: number, scale: number): void;
    /**
     * Write Decimal128 (stored as Int128)
     */
    writeDecimal128(value: number | bigint, scale: number): void;
    writeBool(value: boolean): void;
    /**
     * Write IPv4 address (UInt32 in network byte order)
     */
    writeIPv4(value: string | number): void;
    /**
     * Write IPv6 address (16 bytes)
     */
    writeIPv6(value: string | Buffer): void;
    private expandIPv6;
    writeEnum8(value: number): void;
    writeEnum16(value: number): void;
}
export type BinaryEncoder = (writer: BinaryWriter, value: any) => void;
/**
 * Create a binary encoder for a ClickHouse column type
 */
export declare function createBinaryEncoder(clickhouseType: string, isNullable?: boolean): BinaryEncoder;
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
export declare function buildBinaryConfig(columns: Array<{
    name: string;
    type: string;
    isNull: boolean;
    propKey: string;
}>): BinarySerializationConfig;
/**
 * Serialize a single row to RowBinary format
 */
export declare function serializeRowBinary(row: Record<string, any>, config: BinarySerializationConfig, writer?: BinaryWriter): Buffer;
/**
 * Serialize multiple rows to a single RowBinary buffer
 */
export declare function serializeRowsBinary(rows: Array<Record<string, any>>, config: BinarySerializationConfig): Buffer;
