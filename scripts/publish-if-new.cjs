const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const packages = [
    { name: '@housekit/orm', path: 'packages/orm' },
    { name: '@housekit/kit', path: 'packages/kit' }
];

function getRegistryVersion(packageName) {
    try {
        return execSync(`npm view ${packageName} version --registry https://registry.npmjs.org`, { encoding: 'utf8' }).trim();
    } catch {
        return '0.0.0';
    }
}

console.log('🚀 Checking for new versions to publish...\n');

let publishedAny = false;

for (const pkg of packages) {
    const pkgJsonPath = path.join(process.cwd(), pkg.path, 'package.json');
    const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
    const localVersion = pkgJson.version;
    const remoteVersion = getRegistryVersion(pkg.name);

    if (localVersion !== remoteVersion) {
        console.log(`📦 New version detected for ${pkg.name}: ${remoteVersion} -> ${localVersion}`);
        console.log(`🔨 Building and publishing...`);
        
        try {
            // Ejecutamos el build dentro de la carpeta del paquete
            execSync('npm run build', { cwd: path.join(process.cwd(), pkg.path), stdio: 'inherit' });
            // Publicamos
            execSync('npm publish --access=public', { cwd: path.join(process.cwd(), pkg.path), stdio: 'inherit' });
            
            console.log(`✅ Successfully published ${pkg.name}@${localVersion}\n`);
            publishedAny = true;
        } catch (error) {
            console.error(`❌ Failed to publish ${pkg.name}: ${error.message}`);
            process.exit(1);
        }
    } else {
        console.log(`✨ ${pkg.name} is up to date (${localVersion}). Skipping.`);
    }
}

if (!publishedAny) {
    console.log('\n😴 No version changes detected. Nothing to publish.');
}
