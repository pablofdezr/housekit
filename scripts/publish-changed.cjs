const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const bumpedPackagesPath = path.join(__dirname, '..', '.bumped-packages.json');

// Check if the bumped packages file exists
if (!fs.existsSync(bumpedPackagesPath)) {
    console.log('⚠️  No .bumped-packages.json file found.');
    console.log('   Run "npm run release:all" first to bump versions.');
    process.exit(1);
}

// Read the bumped packages
const bumpedPackages = JSON.parse(fs.readFileSync(bumpedPackagesPath, 'utf8'));

if (bumpedPackages.length === 0) {
    console.log('✅ No packages to publish (no changes detected)');
    process.exit(0);
}

console.log('📦 Publishing changed packages...\n');

let successCount = 0;
let failCount = 0;

for (const pkg of bumpedPackages) {
    const pkgDir = path.join(__dirname, '..', 'packages', pkg.path);

    console.log(`Publishing ${pkg.name}@${pkg.version}...`);

    try {
        execSync('npm publish --access=public', {
            cwd: pkgDir,
            stdio: 'inherit'
        });
        console.log(`  ✅ Successfully published ${pkg.name}@${pkg.version}\n`);
        successCount++;
    } catch (error) {
        console.error(`  ❌ Failed to publish ${pkg.name}@${pkg.version}\n`);
        failCount++;
    }
}

console.log('='.repeat(60));
console.log('📊 Publish Summary:');
console.log('='.repeat(60));
console.log(`✅ Successfully published: ${successCount}`);
if (failCount > 0) {
    console.log(`❌ Failed to publish: ${failCount}`);
}
console.log('='.repeat(60));

// Clean up the bumped packages file
fs.unlinkSync(bumpedPackagesPath);
console.log('\n🧹 Cleaned up .bumped-packages.json');

// Commit and tag changes
if (successCount > 0) {
    console.log('\n🏷️  Commiting and tagging changes...');
    try {
        // Add all changed package.json files
        for (const pkg of bumpedPackages) {
            const pkgPath = path.join(__dirname, '..', 'packages', pkg.path, 'package.json');
            execSync(`git add ${pkgPath}`, { stdio: 'inherit' });
        }

        // Commit
        const packageNames = bumpedPackages.map(p => `${p.name}@${p.version}`).join(', ');
        execSync(`git commit -m "release: ${packageNames}"`, { stdio: 'inherit' });

        // Tag each package
        for (const pkg of bumpedPackages) {
            const tagName = `${pkg.name}@${pkg.version}`;
            execSync(`git tag -a ${tagName} -m "${tagName}"`, { stdio: 'inherit' });
            console.log(`  ✅ Tagged ${tagName}`);
        }

        console.log('\n✨ All changes committed and tagged.');
        console.log('   Run "git push origin main --follow-tags" to sync with GitHub.');
    } catch (error) {
        console.error(`\n❌ Failed to commit or tag: ${error.message}`);
    }
}

if (failCount > 0) {
    process.exit(1);
}
