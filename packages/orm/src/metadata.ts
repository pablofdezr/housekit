// Centralized metadata version support for Housekit ORM.

export const supportedMetadataVersions = ['1.1.0', '1.2.0'] as const;
export type MetadataVersion = typeof supportedMetadataVersions[number];
export const defaultMetadataVersion: MetadataVersion = '1.2.0';

export type HousekitMetadata =
    | { version: '1.1.0'; appendOnly: boolean }
    | { version: '1.2.0'; appendOnly: boolean; readOnly: boolean };

export const housekitMetadataSchemas: Record<MetadataVersion, Record<string, string>> = {
    '1.1.0': { version: 'string', appendOnly: 'boolean' },
    '1.2.0': { version: 'string', appendOnly: 'boolean', readOnly: 'boolean' }
};

export const housekitMetadataDefaults: Record<MetadataVersion, { appendOnly: boolean; readOnly?: boolean }> = {
    '1.1.0': { appendOnly: true },
    '1.2.0': { appendOnly: true, readOnly: false }
};

export function assertMetadataVersion(version: string): asserts version is MetadataVersion {
    if (!supportedMetadataVersions.includes(version as MetadataVersion)) {
        throw new Error(`Unsupported housekit metadata version "${version}". Supported versions: ${supportedMetadataVersions.join(', ')}`);
    }
}

export function getMetadataDefaults(version: MetadataVersion) {
    return housekitMetadataDefaults[version];
}

export function buildHousekitMetadata(version: MetadataVersion, opts: { appendOnly?: boolean; readOnly?: boolean }): HousekitMetadata {
    const defaults = getMetadataDefaults(version);
    if (version === '1.1.0') {
        return { version, appendOnly: opts.appendOnly ?? defaults.appendOnly };
    }
    if (version === '1.2.0') {
        return { version, appendOnly: opts.appendOnly ?? defaults.appendOnly, readOnly: opts.readOnly ?? defaults.readOnly ?? false };
    }
    // Safeguard (assertMetadataVersion should prevent this)
    assertMetadataVersion(version);
    return buildHousekitMetadata(defaultMetadataVersion, opts);
}

export function normalizeHousekitMetadata(raw: any): { version: MetadataVersion; meta: HousekitMetadata } | null {
    if (!raw || typeof raw !== 'object') return null;
    if (!raw.version) return null;
    const versionStr = String(raw.version);
    try {
        assertMetadataVersion(versionStr);
    } catch {
        return null;
    }
    const version = versionStr as MetadataVersion;
    if (version === '1.1.0') {
        return { version, meta: { version, appendOnly: Boolean(raw.appendOnly ?? true) } };
    }
    if (version === '1.2.0') {
        return { version, meta: { version, appendOnly: Boolean(raw.appendOnly ?? true), readOnly: Boolean(raw.readOnly ?? false) } };
    }
    return null;
}

export function upgradeMetadataVersion(
    base: HousekitMetadata | null,
    targetVersion: MetadataVersion,
    overrides?: { appendOnly?: boolean; readOnly?: boolean }
): HousekitMetadata {
    const defaults = getMetadataDefaults(targetVersion);
    const appendOnly = overrides?.appendOnly ?? base?.appendOnly ?? defaults.appendOnly;
    if (targetVersion === '1.1.0') {
        return { version: '1.1.0', appendOnly };
    }
    const readOnly = overrides?.readOnly ?? (base && 'readOnly' in base ? base.readOnly : defaults.readOnly ?? false);
    return { version: '1.2.0', appendOnly, readOnly };
}
