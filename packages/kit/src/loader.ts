import { resolve, basename, dirname } from 'path';
import { existsSync, statSync, mkdirSync } from 'fs';
import { globSync, Glob } from 'glob';
import { info } from './ui';
import { createJiti } from 'jiti';

const jiti = createJiti(import.meta.url);

export async function loadSchema(schemaPath: string, options?: { quiet?: boolean }) {
    if (!options?.quiet) {
        info(`Searching for schemas in: ${schemaPath}`);
    }

    const tables: Record<string, any> = {};

    // Use glob to search for files - support both TS and JS
    const extensions = ['.ts', '.js', '.mjs', '.cjs'];
    const patterns = extensions.map(ext => `${schemaPath}/**/*${ext}`);

    let allFiles: string[] = [];

    if (existsSync(schemaPath) && statSync(schemaPath).isFile()) {
        allFiles = [schemaPath];
    } else {
        for (const pattern of patterns) {
            const files = globSync(pattern);
            allFiles = allFiles.concat(files);
        }
    }

    // Deduplicate files by base name (prefer .ts over .js)
    // This prevents loading both index.ts and index.js, or foo.schema.ts and foo.schema.js
    const filesByBaseName = new Map<string, string>();
    const extensionPriority: Record<string, number> = { '.ts': 0, '.mjs': 1, '.cjs': 2, '.js': 3 };
    
    for (const file of allFiles) {
        const ext = extensions.find(e => file.endsWith(e)) || '.js';
        const baseNameWithoutExt = file.slice(0, -ext.length);
        
        const existing = filesByBaseName.get(baseNameWithoutExt);
        if (existing) {
            const existingExt = extensions.find(e => existing.endsWith(e)) || '.js';
            // Keep the one with higher priority (lower number)
            if (extensionPriority[ext] < extensionPriority[existingExt]) {
                filesByBaseName.set(baseNameWithoutExt, file);
            }
        } else {
            filesByBaseName.set(baseNameWithoutExt, file);
        }
    }
    
    const deduplicatedFiles = Array.from(filesByBaseName.values());

    // Process files
    const foundTables: string[] = [];
    const tableSourceFile: Record<string, string> = {}; // Track which file defined each table
    
    for (const file of deduplicatedFiles) {
        const fullPath = resolve(process.cwd(), file);

        try {
            // Dynamically import the file using jiti for TS support
            const module: any = await jiti.import(fullPath);

            // Look for exports that look like Housekit tables
            for (const [key, value] of Object.entries(module)) {
                // Verify if it has the structure of a table ($table, $columns, toSQL)
                if (value && typeof value === 'object' && 'toSQL' in value && '$columns' in value && '$table' in value) {
                    const table = value as any;
                    if (tables[table.$table]) {
                        // Skip if it's the same table object (re-exported from another file)
                        if (tables[table.$table] === table) {
                            continue;
                        }
                        throw new Error(`Duplicate: Table "${table.$table}" is defined multiple times (in ${tableSourceFile[table.$table]} and ${file}).`);
                    }
                    tables[table.$table] = table;
                    tableSourceFile[table.$table] = file;
                    foundTables.push(`${table.$table}${key !== table.$table ? ` (${key})` : ''}`);
                }
            }
        } catch (error: any) {
            const errorMessage = error.message || String(error);
            const isModuleNotFound =
                error.code === 'ERR_MODULE_NOT_FOUND' ||
                error.code === 'MODULE_NOT_FOUND' ||
                errorMessage.includes('Cannot find package') ||
                errorMessage.includes('Cannot find module') ||
                errorMessage.includes('MODULE_NOT_FOUND');

            const isHousekitCoreError = errorMessage.includes('@housekit/orm');

            if (isModuleNotFound || isHousekitCoreError) {
                throw new Error(
                    `Failed to load schema file: ${file}\n\n` +
                    `${errorMessage}\n\n` +
                    `Make sure you have installed @housekit/orm in your project:\n` +
                    `  npm install @housekit/orm (or bun add, pnpm add)\n\n` +
                    `If using npx/bunx, ensure all dependencies are available in your project.`
                );
            }

            throw error;
        }
    }

    if (!options?.quiet && foundTables.length > 0) {
        info(`Found tables: ${foundTables.join(', ')}`);
    }

    return tables;
}

// Utility to load housekit.config.{ts,js,mjs,cjs}
async function findConfigPaths(root: string) {
    const extensions = ['ts', 'js', 'mjs', 'cjs'];
    const matches: string[] = [];

    for (const ext of extensions) {
        const glob = new Glob(`**/housekit.config.${ext}`, { cwd: root });

        for await (const file of glob) {
            // Avoid traversing node_modules/.git
            if (file.includes('node_modules') || file.includes('.git')) continue;
            matches.push(resolve(root, file));
            if (matches.length > 1) break;
        }

        // If we found a config, stop searching other extensions
        if (matches.length > 0) break;
    }

    return matches;
}

export async function getConfigPath(root: string = process.cwd()) {
    const configs = await findConfigPaths(root);

    if (configs.length === 0) {
        throw new Error('housekit.config.{ts,js,mjs,cjs} not found in workspace.');
    }

    if (configs.length > 1) {
        throw new Error(`Multiple housekit.config files found: ${configs.join(', ')}`);
    }

    return configs[0];
}

import { validateConfig } from './validation';
import { error, warn } from './ui';

export async function loadConfig() {
    const configPath = await getConfigPath();
    const module: any = await jiti.import(configPath);
    const config = module.default as import('./config').HouseKitConfig;

    const validation = validateConfig(config);

    if (validation.warnings.length > 0) {
        for (const warning of validation.warnings) {
            warn(`Config warning [${warning.field}]: ${warning.message}`);
        }
    }

    if (!validation.valid) {
        for (const err of validation.errors) {
            error(`Config error [${err.field}]: ${err.message}`);
        }
        throw new Error('Configuration validation failed');
    }

    // Auto-create output directory if it doesn't exist
    const outDir = resolve(process.cwd(), config.out);
    if (!existsSync(outDir)) {
        mkdirSync(outDir, { recursive: true });
        info(`Created output directory: ${config.out}`);
    }

    return config;
}
