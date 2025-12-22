/**
 * Shared utilities for version management
 */

function parse(v) {
    const parts = v.split('.').map(Number);
    if (parts.length !== 3 || parts.some(n => Number.isNaN(n))) {
        throw new Error(`Unexpected version format: ${v}`);
    }
    return parts;
}

function cmp(a, b) {
    for (let i = 0; i < 3; i++) {
        if (a[i] > b[i]) return 1;
        if (a[i] < b[i]) return -1;
    }
    return 0;
}

function bumpMajor(version) {
    const [major] = parse(version);
    return `${major + 1}.0.0`;
}

function bumpMinor(version) {
    const [major, minor] = parse(version);
    return `${major}.${minor + 1}.0`;
}

function bumpPatch(version) {
    const [major, minor, patch] = parse(version);
    return `${major}.${minor}.${patch + 1}`;
}

/**
 * Parse command line arguments for version bumping
 * Supports:
 *   --version=1.2.3
 *   --major=2 --minor=1 --patch=0
 *   --major (bump major)
 *   --minor (bump minor)
 *   --patch (bump patch, default)
 */
function parseVersionArgs(args = process.argv.slice(2)) {
    const result = {
        type: 'patch', // default
        exactVersion: null,
        major: null,
        minor: null,
        patch: null
    };

    for (const arg of args) {
        // --version=1.2.3
        if (arg.startsWith('--version=')) {
            const version = arg.split('=')[1];
            const parts = parse(version); // Validate format
            result.exactVersion = version;
            result.type = 'exact';
            continue;
        }

        // --major=2
        if (arg.startsWith('--major=')) {
            result.major = parseInt(arg.split('=')[1], 10);
            if (isNaN(result.major) || result.major < 0) {
                throw new Error(`Invalid major version: ${arg}`);
            }
            result.type = 'exact';
            continue;
        }

        // --minor=1
        if (arg.startsWith('--minor=')) {
            result.minor = parseInt(arg.split('=')[1], 10);
            if (isNaN(result.minor) || result.minor < 0) {
                throw new Error(`Invalid minor version: ${arg}`);
            }
            result.type = 'exact';
            continue;
        }

        // --patch=0
        if (arg.startsWith('--patch=')) {
            result.patch = parseInt(arg.split('=')[1], 10);
            if (isNaN(result.patch) || result.patch < 0) {
                throw new Error(`Invalid patch version: ${arg}`);
            }
            result.type = 'exact';
            continue;
        }

        // --major (bump major)
        if (arg === '--major') {
            result.type = 'major';
            continue;
        }

        // --minor (bump minor)
        if (arg === '--minor') {
            result.type = 'minor';
            continue;
        }

        // --patch (bump patch)
        if (arg === '--patch') {
            result.type = 'patch';
            continue;
        }
    }

    // If we have individual components, construct the exact version
    if (result.type === 'exact' && !result.exactVersion) {
        if (result.major !== null && result.minor !== null && result.patch !== null) {
            result.exactVersion = `${result.major}.${result.minor}.${result.patch}`;
        }
    }

    return result;
}

/**
 * Calculate the new version based on current version and version args
 */
function calculateNewVersion(currentVersion, registryVersion, versionArgs) {
    // Determine the base version (higher of current or registry)
    const current = parse(currentVersion);
    const remote = parse(registryVersion);
    const baseVersion = cmp(current, remote) >= 0 ? currentVersion : registryVersion;

    // If exact version is specified
    if (versionArgs.exactVersion) {
        const exact = parse(versionArgs.exactVersion);
        const base = parse(baseVersion);

        // Validate that the exact version is higher than base
        if (cmp(exact, base) <= 0) {
            throw new Error(
                `Exact version ${versionArgs.exactVersion} must be higher than current version ${baseVersion}`
            );
        }

        return versionArgs.exactVersion;
    }

    // Otherwise, bump based on type
    switch (versionArgs.type) {
        case 'major':
            return bumpMajor(baseVersion);
        case 'minor':
            return bumpMinor(baseVersion);
        case 'patch':
        default:
            return bumpPatch(baseVersion);
    }
}

/**
 * Format version args for display
 */
function formatVersionArgsDisplay(versionArgs) {
    if (versionArgs.exactVersion) {
        return `exact version: ${versionArgs.exactVersion}`;
    }
    return `bump ${versionArgs.type}`;
}

module.exports = {
    parse,
    cmp,
    bumpMajor,
    bumpMinor,
    bumpPatch,
    parseVersionArgs,
    calculateNewVersion,
    formatVersionArgsDisplay
};
