#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const packagePath = process.argv[2];
if (!packagePath) {
    console.error('Usage: node prepare-publish.js <package-path>');
    process.exit(1);
}

const pkgJsonPath = resolve(packagePath, 'package.json');
const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));

// Replace workspace:* with actual versions
if (pkg.dependencies) {
    for (const [name, version] of Object.entries(pkg.dependencies)) {
        if (version === 'workspace:*') {
            // Use the current package version
            pkg.dependencies[name] = `^${pkg.version}`;
        }
    }
}

writeFileSync(pkgJsonPath, JSON.stringify(pkg, null, 2) + '\n');
console.log(`✓ Prepared ${pkg.name} for publishing`);
