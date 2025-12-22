const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const {
    parseVersionArgs,
    calculateNewVersion,
    formatVersionArgsDisplay
} = require('./version-utils.cjs');

const pkgPath = path.join(__dirname, '..', 'packages', 'orm', 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

// Parse version arguments
const versionArgs = parseVersionArgs();

console.log(`🔧 Bumping @housekit/orm (${formatVersionArgsDisplay(versionArgs)})`);

// Get registry version
let registryVersion = '0.0.0';
try {
    const env = { ...process.env };
    const execOpts = {
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 4000,
        env
    };
    registryVersion = execSync(
        'npm view @housekit/orm version --registry https://registry.npmjs.org',
        execOpts
    ).toString().trim() || '0.0.0';
} catch {
    // ignore if package not found or network blocked
}

// Calculate new version
try {
    pkg.version = calculateNewVersion(pkg.version, registryVersion, versionArgs);

    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 4) + '\n');
    console.log(`✅ Bumped @housekit/orm to ${pkg.version} (remote was ${registryVersion})`);
} catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
}
