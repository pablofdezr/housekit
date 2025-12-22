const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const {
    parseVersionArgs,
    calculateNewVersion,
    formatVersionArgsDisplay
} = require('./version-utils.cjs');

// Parse version arguments (applies to all packages)
const versionArgs = parseVersionArgs();

function getRegistryVersion(packageName) {
    try {
        const env = { ...process.env };
        const execOpts = {
            stdio: ['ignore', 'pipe', 'ignore'],
            timeout: 4000,
            env
        };
        return execSync(`npm view ${packageName} version --registry https://registry.npmjs.org`, execOpts)
            .toString().trim() || '0.0.0';
    } catch {
        return '0.0.0';
    }
}

function getLastReleaseTag() {
    try {
        // Get the most recent tag that looks like a version number
        const tags = execSync('git tag --sort=-version:refname', { encoding: 'utf8' })
            .split('\n')
            .filter(tag => tag.match(/^v?\d+\.\d+\.\d+/));

        return tags[0] || null;
    } catch {
        return null;
    }
}

function hasPackageChanged(packagePath, sinceTag) {
    try {
        const pkgDir = path.join('packages', packagePath);

        if (!sinceTag) {
            // No previous tag, consider everything changed
            console.log(`  ℹ️  No previous release tag found, considering ${packagePath} as changed`);
            return true;
        }

        // Check if there are any changes in the package directory since the tag
        const changes = execSync(
            `git diff --name-only ${sinceTag} HEAD -- ${pkgDir}`,
            { encoding: 'utf8', cwd: path.join(__dirname, '..') }
        ).trim();

        if (changes) {
            console.log(`  ✓ ${packagePath} has changes since ${sinceTag}:`);
            changes.split('\n').forEach(file => console.log(`    - ${file}`));
            return true;
        } else {
            console.log(`  ○ ${packagePath} has no changes since ${sinceTag}`);
            return false;
        }
    } catch (error) {
        console.log(`  ⚠️  Error checking ${packagePath}, considering as changed:`, error.message);
        return true;
    }
}

function bumpPackage(packageName, packagePath) {
    const pkgPath = path.join(__dirname, '..', 'packages', packagePath, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

    const registryVersion = getRegistryVersion(packageName);

    try {
        pkg.version = calculateNewVersion(pkg.version, registryVersion, versionArgs);
        fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 4) + '\n');
        console.log(`  ✅ Bumped ${packageName} to ${pkg.version} (remote was ${registryVersion})`);
        return pkg.version;
    } catch (error) {
        console.error(`  ❌ Error bumping ${packageName}: ${error.message}`);
        process.exit(1);
    }
}

function updateDependency(packagePath, depName, newVersion) {
    const pkgPath = path.join(__dirname, '..', 'packages', packagePath, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

    if (pkg.dependencies && pkg.dependencies[depName]) {
        pkg.dependencies[depName] = `^${newVersion}`;
        fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 4) + '\n');
        console.log(`  ↳ Updated ${depName} dependency in ${packagePath} to ^${newVersion}`);
    }
}

console.log('🔍 Checking for changed packages...\n');
console.log(`📋 Version bump strategy: ${formatVersionArgsDisplay(versionArgs)}\n`);

const lastTag = getLastReleaseTag();
if (lastTag) {
    console.log(`📌 Last release tag: ${lastTag}\n`);
} else {
    console.log(`📌 No previous release tag found\n`);
}

// Check which packages have changed
const packages = [
    { name: '@housekit/orm', path: 'orm', deps: [] },
    { name: '@housekit/kit', path: 'kit', deps: ['@housekit/orm'] }
];

const changedPackages = new Map();
const bumpedVersions = new Map();

// Detect changes
console.log('Detecting changes:\n');
for (const pkg of packages) {
    const hasChanged = hasPackageChanged(pkg.path, lastTag);
    changedPackages.set(pkg.name, hasChanged);
}

// Check if any dependency has changed - if so, dependent packages should also be bumped
console.log('\n🔗 Checking dependency chain:\n');
for (const pkg of packages) {
    if (changedPackages.get(pkg.name)) {
        console.log(`  ✓ ${pkg.name} will be bumped (has direct changes)`);
        continue;
    }

    // Check if any dependency has changed
    const hasChangedDep = pkg.deps.some(dep => changedPackages.get(dep));
    if (hasChangedDep) {
        console.log(`  ✓ ${pkg.name} will be bumped (dependency changed)`);
        changedPackages.set(pkg.name, true);
    } else {
        console.log(`  ○ ${pkg.name} will NOT be bumped (no changes)`);
    }
}

// Bump versions for changed packages
console.log('\n📦 Bumping versions:\n');
for (const pkg of packages) {
    if (changedPackages.get(pkg.name)) {
        const newVersion = bumpPackage(pkg.name, pkg.path);
        bumpedVersions.set(pkg.name, newVersion);
    }
}

// Update dependencies
console.log('\n🔄 Updating dependencies:\n');
for (const pkg of packages) {
    for (const dep of pkg.deps) {
        const newDepVersion = bumpedVersions.get(dep);
        if (newDepVersion) {
            updateDependency(pkg.path, dep, newDepVersion);
        }
    }
}

// Summary
console.log('\n' + '='.repeat(60));
console.log('📊 Summary:');
console.log('='.repeat(60));

const bumped = Array.from(bumpedVersions.entries());
if (bumped.length > 0) {
    console.log('\n✅ Packages bumped:');
    bumped.forEach(([name, version]) => {
        console.log(`  - ${name}: ${version}`);
    });
} else {
    console.log('\n⚠️  No packages were bumped (no changes detected)');
}

const skipped = packages.filter(pkg => !bumpedVersions.has(pkg.name));
if (skipped.length > 0) {
    console.log('\n○ Packages skipped (no changes):');
    skipped.forEach(pkg => {
        console.log(`  - ${pkg.name}`);
    });
}

console.log('\n' + '='.repeat(60));

// Write bumped packages to a file for the publish script
const bumpedPackages = packages
    .filter(pkg => bumpedVersions.has(pkg.name))
    .map(pkg => ({
        name: pkg.name,
        path: pkg.path,
        version: bumpedVersions.get(pkg.name)
    }));

const outputPath = path.join(__dirname, '..', '.bumped-packages.json');
fs.writeFileSync(outputPath, JSON.stringify(bumpedPackages, null, 2) + '\n');
console.log(`\n💾 Bumped packages list saved to .bumped-packages.json`);
