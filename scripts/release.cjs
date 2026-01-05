#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const {
    parse,
    cmp,
    bumpMajor,
    bumpMinor,
    bumpPatch,
    parseVersionArgs,
    formatVersionArgsDisplay
} = require('./version-utils.cjs');

const PACKAGES = {
    orm: {
        path: path.join(__dirname, '..', 'packages', 'orm'),
        name: '@housekit/orm'
    },
    kit: {
        path: path.join(__dirname, '..', 'packages', 'kit'),
        name: '@housekit/kit'
    }
};

/**
 * Parse command line arguments
 * Supports:
 *   --orm --version=1.2.3
 *   --kit --next
 *   --all --minor
 *   --orm --major
 *   etc.
 */
function parseReleaseArgs() {
    const args = process.argv.slice(2);
    const result = {
        packages: [],
        versionArgs: {
            type: 'patch',
            exactVersion: null,
            major: null,
            minor: null,
            patch: null
        },
        build: true,
        publish: true
    };

    let i = 0;
    while (i < args.length) {
        const arg = args[i];

        if (arg === '--orm') {
            result.packages.push('orm');
        } else if (arg === '--kit') {
            result.packages.push('kit');
        } else if (arg === '--all') {
            result.packages = ['orm', 'kit'];
        } else if (arg === '--next') {
            // Alias for --patch (semantic versioning)
            result.versionArgs.type = 'patch';
        } else if (arg === '--major') {
            result.versionArgs.type = 'major';
        } else if (arg === '--minor') {
            result.versionArgs.type = 'minor';
        } else if (arg === '--patch') {
            result.versionArgs.type = 'patch';
        } else if (arg.startsWith('--version=')) {
            const version = arg.split('=')[1];
            const parts = parse(version);
            result.versionArgs.exactVersion = version;
            result.versionArgs.type = 'exact';
        } else if (arg.startsWith('--major=')) {
            result.versionArgs.major = parseInt(arg.split('=')[1], 10);
            if (isNaN(result.versionArgs.major) || result.versionArgs.major < 0) {
                throw new Error(`Invalid major version: ${arg}`);
            }
            result.versionArgs.type = 'exact';
        } else if (arg.startsWith('--minor=')) {
            result.versionArgs.minor = parseInt(arg.split('=')[1], 10);
            if (isNaN(result.versionArgs.minor) || result.versionArgs.minor < 0) {
                throw new Error(`Invalid minor version: ${arg}`);
            }
            result.versionArgs.type = 'exact';
        } else if (arg.startsWith('--patch=')) {
            result.versionArgs.patch = parseInt(arg.split('=')[1], 10);
            if (isNaN(result.versionArgs.patch) || result.versionArgs.patch < 0) {
                throw new Error(`Invalid patch version: ${arg}`);
            }
            result.versionArgs.type = 'exact';
        } else if (arg === '--no-build') {
            result.build = false;
        } else if (arg === '--no-publish') {
            result.publish = false;
        } else {
            console.error(`Unknown argument: ${arg}`);
            console.log('\nUsage: bun run release [options]');
            console.log('\nOptions:');
            console.log('  Package selection:');
            console.log('    --orm          Release only ORM');
            console.log('    --kit          Release only Kit');
            console.log('    --all          Release both packages');
            console.log('\n  Version specification:');
            console.log('    --next         Auto-bump to next patch version (default)');
            console.log('    --major        Bump major version');
            console.log('    --minor        Bump minor version');
            console.log('    --patch        Bump patch version');
            console.log('    --version=X.Y.Z Set exact version');
            console.log('    --major=X      Set major version');
            console.log('    --minor=X      Set minor version');
            console.log('    --patch=X      Set patch version');
            console.log('\n  Other:');
            console.log('    --no-build     Skip build step');
            console.log('    --no-publish   Skip publish step');
            process.exit(1);
        }

        i++;
    }

    // If we have individual components, construct exact version
    if (result.versionArgs.type === 'exact' && !result.versionArgs.exactVersion) {
        if (result.versionArgs.major !== null &&
            result.versionArgs.minor !== null &&
            result.versionArgs.patch !== null) {
            result.versionArgs.exactVersion =
                `${result.versionArgs.major}.${result.versionArgs.minor}.${result.versionArgs.patch}`;
        }
    }

    // Default to all packages if none specified
    if (result.packages.length === 0) {
        result.packages = ['orm', 'kit'];
    }

    return result;
}

/**
 * Get registry version for a package
 */
function getRegistryVersion(packageName) {
    try {
        const env = { ...process.env };
        const execOpts = {
            stdio: ['ignore', 'pipe', 'ignore'],
            timeout: 4000,
            env
        };
        const version = execSync(
            `npm view ${packageName} version --registry https://registry.npmjs.org`,
            execOpts
        ).toString().trim();
        return version || '0.0.0';
    } catch {
        return '0.0.0';
    }
}

/**
 * Calculate new version based on current version and version args
 */
function calculateNewVersion(currentVersion, registryVersion, versionArgs) {
    const current = parse(currentVersion);
    const remote = parse(registryVersion);
    const baseVersion = cmp(current, remote) >= 0 ? currentVersion : registryVersion;

    if (versionArgs.exactVersion) {
        const exact = parse(versionArgs.exactVersion);
        const base = parse(baseVersion);

        if (cmp(exact, base) <= 0) {
            throw new Error(
                `Exact version ${versionArgs.exactVersion} must be higher than current version ${baseVersion}`
            );
        }

        return versionArgs.exactVersion;
    }

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
 * Bump version for a package
 */
function bumpPackage(packageName, versionArgs) {
    const pkgInfo = PACKAGES[packageName];
    const pkgPath = path.join(pkgInfo.path, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

    console.log(`\n🔧 Processing ${pkgInfo.name}...`);

    const registryVersion = getRegistryVersion(pkgInfo.name);
    console.log(`   Current: ${pkg.version}`);
    console.log(`   Remote:  ${registryVersion}`);

    const newVersion = calculateNewVersion(pkg.version, registryVersion, versionArgs);
    pkg.version = newVersion;

    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 4) + '\n');
    console.log(`   ✅ Bumped to ${newVersion}`);

    return newVersion;
}

/**
 * Build packages
 */
function buildPackages(packages) {
    if (!packages.includes('orm') && !packages.includes('kit')) {
        return;
    }

    console.log('\n🏗️  Building packages...');

    const filters = [];
    if (packages.includes('orm')) {
        filters.push('--filter=@housekit/orm');
    }
    if (packages.includes('kit')) {
        filters.push('--filter=@housekit/kit');
    }

    try {
        execSync(`bun run build ${filters.join(' ')}`, { stdio: 'inherit' });
        console.log('   ✅ Build completed');
    } catch (error) {
        console.error('   ❌ Build failed');
        throw error;
    }
}

/**
 * Publish a package
 */
function publishPackage(packageName) {
    const pkgInfo = PACKAGES[packageName];

    console.log(`\n📦 Publishing ${pkgInfo.name}...`);

    try {
        execSync('npm publish --access=public', {
            cwd: pkgInfo.path,
            stdio: 'inherit'
        });
        console.log('   ✅ Published successfully');
    } catch (error) {
        console.error('   ❌ Publish failed');
        throw error;
    }
}

/**
 * Commit and tag a package release
 */
function tagPackage(packageName, version) {
    const pkgInfo = PACKAGES[packageName];
    const tagName = `${pkgInfo.name}@${version}`;
    const pkgPath = path.join(pkgInfo.path, 'package.json');

    console.log(`\n🏷️  Tagging ${tagName}...`);

    try {
        // Add package.json
        execSync(`git add ${pkgPath}`, { stdio: 'inherit' });

        // Commit
        const commitMsg = `release: ${tagName}`;
        execSync(`git commit -m "${commitMsg}"`, { stdio: 'inherit' });

        // Tag
        execSync(`git tag -a ${tagName} -m "${tagName}"`, { stdio: 'inherit' });

        console.log(`   ✅ Committed and tagged: ${tagName}`);
    } catch (error) {
        console.error(`   ❌ Failed to tag ${tagName}: ${error.message}`);
        // Don't throw here, continue with other packages if any
    }
}

/**
 * Main function
 */
function main() {
    console.log('🚀 HouseKit Release Manager');

    const args = parseReleaseArgs();

    console.log(`\n📋 Release plan:`);
    console.log(`   Packages: ${args.packages.join(', ')}`);
    console.log(`   Version:  ${formatVersionArgsDisplay(args.versionArgs)}`);
    console.log(`   Build:    ${args.build ? 'yes' : 'no'}`);
    console.log(`   Publish:  ${args.publish ? 'yes' : 'no'}`);

    try {
        const versions = {};

        for (const pkg of args.packages) {
            versions[pkg] = bumpPackage(pkg, args.versionArgs);
        }

        if (args.build) {
            buildPackages(args.packages);
        }

        if (args.publish) {
            for (const pkg of args.packages) {
                publishPackage(pkg);
            }
        }

        // Tag after publish (or even if no publish, as long as bumped)
        for (const pkg of args.packages) {
            tagPackage(pkg, versions[pkg]);
        }

        console.log('\n✨ Release completed successfully!');
        console.log('\n📦 Published packages:');
        for (const pkg of args.packages) {
            const pkgInfo = PACKAGES[pkg];
            console.log(`   ${pkgInfo.name}@${versions[pkg]}`);
        }

    } catch (error) {
        console.error(`\n❌ Release failed: ${error.message}`);
        process.exit(1);
    }
}

main();
