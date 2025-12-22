const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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

function bumpPatch(version) {
    const [major, minor, patch] = parse(version);
    return `${major}.${minor}.${patch + 1}`;
}

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

function bumpPackage(packageName, packagePath) {
    const pkgPath = path.join(__dirname, '..', 'packages', packagePath, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    
    const registryVersion = getRegistryVersion(packageName);
    const current = parse(pkg.version);
    const remote = parse(registryVersion);
    const base = cmp(current, remote) >= 0 ? pkg.version : registryVersion;
    pkg.version = bumpPatch(base);
    
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 4) + '\n');
    console.log(`Bumped ${packageName} to ${pkg.version} (remote was ${registryVersion})`);
    
    return pkg.version;
}

// Bump in order: orm -> kit (respecting dependencies)
const ormVersion = bumpPackage('@housekit/orm', 'orm');

// Update kit's dependency on orm
const kitPkgPath = path.join(__dirname, '..', 'packages', 'kit', 'package.json');
const kitPkg = JSON.parse(fs.readFileSync(kitPkgPath, 'utf8'));
kitPkg.dependencies['@housekit/orm'] = `^${ormVersion}`;
fs.writeFileSync(kitPkgPath, JSON.stringify(kitPkg, null, 4) + '\n');

const kitVersion = bumpPackage('@housekit/kit', 'kit');

console.log('\n✅ All versions bumped:');
console.log(`  - @housekit/orm: ${ormVersion}`);
console.log(`  - @housekit/kit: ${kitVersion}`);
