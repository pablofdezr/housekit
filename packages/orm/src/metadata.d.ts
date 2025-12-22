export declare const supportedMetadataVersions: readonly ["1.1.0", "1.2.0"];
export type MetadataVersion = typeof supportedMetadataVersions[number];
export declare const defaultMetadataVersion: MetadataVersion;
export type HousekitMetadata = {
    version: '1.1.0';
    appendOnly: boolean;
} | {
    version: '1.2.0';
    appendOnly: boolean;
    readOnly: boolean;
};
export declare const housekitMetadataSchemas: Record<MetadataVersion, Record<string, string>>;
export declare const housekitMetadataDefaults: Record<MetadataVersion, {
    appendOnly: boolean;
    readOnly?: boolean;
}>;
export declare function assertMetadataVersion(version: string): asserts version is MetadataVersion;
export declare function getMetadataDefaults(version: MetadataVersion): {
    appendOnly: boolean;
    readOnly?: boolean;
};
export declare function buildHousekitMetadata(version: MetadataVersion, opts: {
    appendOnly?: boolean;
    readOnly?: boolean;
}): HousekitMetadata;
export declare function normalizeHousekitMetadata(raw: any): {
    version: MetadataVersion;
    meta: HousekitMetadata;
} | null;
export declare function upgradeMetadataVersion(base: HousekitMetadata | null, targetVersion: MetadataVersion, overrides?: {
    appendOnly?: boolean;
    readOnly?: boolean;
}): HousekitMetadata;
