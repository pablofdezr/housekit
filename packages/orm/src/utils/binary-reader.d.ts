/**
 * HouseKit Binary Reader - Ultra-Fast RowBinary Decoding
 *
 * optimized for reading ClickHouse RowBinary format directly from buffers.
 * This is 10-20x faster than JSON.parse() for large datasets.
 */
export declare class BinaryReader {
    private buffer;
    private offset;
    private view;
    constructor(buffer: Buffer);
    reset(buffer: Buffer): void;
    getOffset(): number;
    isEOF(): boolean;
    readInt8(): number;
    readUInt8(): number;
    readInt16(): number;
    readUInt16(): number;
    readInt32(): number;
    readUInt32(): number;
    readInt64(): bigint;
    readUInt64(): bigint;
    readInt128(): bigint;
    readUInt128(): bigint;
    readInt256(): bigint;
    readUInt256(): bigint;
    readFloat32(): number;
    readFloat64(): number;
    readVarInt(): number;
    readString(): string;
    readFixedString(length: number): string;
    readUUID(): string;
    readDate(): string;
    readDate32(): string;
    readDateTime(): Date;
    readDateTime64(precision?: number): Date;
    readNullable<T>(reader: () => T): T | null;
    readArray<T>(itemReader: () => T): T[];
    readMap<K, V>(keyReader: () => K, valueReader: () => V): Record<any, any>;
    readDecimal32(scale: number): number;
    readDecimal64(scale: number): number;
    readDecimal128(scale: number): number;
    readBool(): boolean;
    readIPv4(): string;
    readIPv6(): string;
}
export type BinaryDecoder = (reader: BinaryReader) => any;
export declare function createBinaryDecoder(type: string): BinaryDecoder;
