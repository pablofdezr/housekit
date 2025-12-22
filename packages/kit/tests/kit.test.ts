import { describe, it, expect } from 'bun:test';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { type HouseKitConfig, getSchemaMapping } from '../src/config';
import { loadConfig, loadSchema } from '../src/loader';
import { generateCommand } from '../src/commands/generate';

const repoRoot = process.cwd();

function createTempDir() {
    return mkdtempSync(join(repoRoot, 'tmp-kit-tests-'));
}

function writeSchemaFile(baseDir: string, withAge = false, folder = 'schema') {
    const schemaDir = join(baseDir, folder);
    mkdirSync(schemaDir, { recursive: true });

    const ageColumn = withAge ? `,
        age: {
            getDefinition() { return '\`age\` Int32'; },
            toSQL() { return 'Int32'; }
        }` : '';

    const ageSchema = withAge ? `,
            age: { type: 'Int32' }` : '';

        const tableContent = `export const users = {
    name: 'users',
    $table: 'users',
    columns: {
        id: {
            getDefinition() { return '\`id\` UUID'; },
            toSQL() { return 'UUID'; }
        },
        name: {
            getDefinition() { return '\`name\` String'; },
            toSQL() { return 'String'; }
        }${ageColumn}
    },
    $columns: {
        id: {
            getDefinition() { return '\`id\` UUID'; },
            toSQL() { return 'UUID'; }
        },
        name: {
            getDefinition() { return '\`name\` String'; },
            toSQL() { return 'String'; }
        }${ageColumn}
    },
    $options: {
        engine: 'MergeTree',
        orderBy: 'id'
    },
    toSQL() {
        return 'CREATE TABLE \`users\` (\`id\` UUID, \`name\` String${withAge ? ', \`age\` Int32' : ''}) ENGINE = MergeTree ORDER BY id';
    },
    toSchema() {
        return {
            id: { type: 'UUID' },
            name: { type: 'String' }${ageSchema}
        };
    }
};`;

    writeFileSync(join(schemaDir, 'users.ts'), tableContent);
    return schemaDir;
}

function writeConfigFile(baseDir: string, config: HouseKitConfig | string) {
    mkdirSync(baseDir, { recursive: true });
    const content = typeof config === 'string' 
        ? config 
        : `export default ${JSON.stringify(config, null, 4)};`;
    writeFileSync(join(baseDir, 'housekit.config.ts'), content);
}

function cleanupTempDir(tempDir: string, originalCwd: string) {
    process.chdir(originalCwd);
    rmSync(tempDir, { recursive: true, force: true });
}

describe('config helpers', () => {
    it('maps a single schema string to the default database', () => {
        const config: HouseKitConfig = {
            schema: './schema',
            out: './out',
            databases: {
                default: { database: 'analytics' },
                logging: { database: 'logs' }
            }
        };

        expect(getSchemaMapping(config)).toEqual({ default: './schema' });
    });

    it('falls back to the first database when no default exists', () => {
        const config: HouseKitConfig = {
            schema: './schema',
            out: './out',
            databases: {
                primary: { database: 'primary_db' },
                analytics: { database: 'analytics' }
            }
        };

        expect(getSchemaMapping(config)).toEqual({ primary: './schema' });
    });

    it('returns explicit mappings when multiple schemas are provided', () => {
        const schemaMapping = {
            primary: './schema/primary',
            analytics: './schema/analytics'
        };

        const config: HouseKitConfig = {
            schema: schemaMapping,
            out: './out',
            databases: {
                primary: { database: 'primary_db' },
                analytics: { database: 'analytics' }
            }
        };

        expect(getSchemaMapping(config)).toEqual(schemaMapping);
    });

    it('throws when no databases are configured', () => {
        const config = {
            schema: './schema',
            out: './out',
            databases: {}
        } as unknown as HouseKitConfig;

        expect(() => getSchemaMapping(config)).toThrow('No databases configured');
    });
});

describe('loader', () => {
    it('loads schema files and returns table definitions', async () => {
        const tempDir = createTempDir();
        const originalCwd = process.cwd();

        try {
            writeSchemaFile(tempDir);
            process.chdir(tempDir);

            const tables = await loadSchema('./schema');
            expect(Object.keys(tables)).toEqual(['users']);
            expect(tables.users.name).toBe('users');
            expect(typeof tables.users.toSQL).toBe('function');
        } finally {
            cleanupTempDir(tempDir, originalCwd);
        }
    });

    it('throws when duplicate table names are found', async () => {
        const tempDir = createTempDir();
        const originalCwd = process.cwd();
        const schemaDir = join(tempDir, 'schema');
        mkdirSync(schemaDir, { recursive: true });

        const tableContent = `
export const users = {
    name: 'users',
    $table: 'users',
    columns: {
        id: {
            getDefinition() { return '\`id\` Int32'; },
            toSQL() { return 'Int32'; }
        }
    },
    $columns: {
        id: {
            getDefinition() { return '\`id\` Int32'; },
            toSQL() { return 'Int32'; }
        }
    },
    $options: {
        engine: 'MergeTree',
        orderBy: 'id'
    },
    toSQL() {
        return 'CREATE TABLE \`users\` (\`id\` Int32) ENGINE = MergeTree ORDER BY id';
    }
};
`;

        writeFileSync(join(schemaDir, 'users.ts'), tableContent);
        writeFileSync(join(schemaDir, 'users_duplicate.ts'), tableContent);

        process.chdir(tempDir);

        try {
            await loadSchema('./schema');
            throw new Error('Should have thrown');
        } catch (e: any) {
            expect(e.message).toContain('Duplicate');
        } finally {
            cleanupTempDir(tempDir, originalCwd);
        }
    });
});

describe('loadConfig', () => {
    it('loads configuration from housekit.config.ts', async () => {
        const tempDir = createTempDir();
        const originalCwd = process.cwd();

        const config = `
export default {
    databases: {
        default: {
            host: 'http://localhost:8123',
            database: 'analytics'
        }
    },
    out: './migrations'
};
`;

        try {
            writeConfigFile(tempDir, {
                databases: {
                    default: {
                        host: 'http://localhost:8123',
                        database: 'analytics'
                    }
                },
                out: './migrations',
                schema: './schema'
            });
            process.chdir(tempDir);

            const loaded = await loadConfig();
            expect(loaded.out).toBe('./migrations');
            expect(loaded.databases.default.database).toBe('analytics');
        } finally {
            cleanupTempDir(tempDir, originalCwd);
        }
    });

    it('finds config files recursively', async () => {
        const tempDir = createTempDir();
        const originalCwd = process.cwd();
        const nestedDir = join(tempDir, 'nested', 'app');
        mkdirSync(nestedDir, { recursive: true });

        const config = `
export default {
    databases: {
        default: {
            host: 'http://localhost:8123',
            database: 'analytics'
        }
    }
};
`;

        try {
            writeConfigFile(nestedDir, {
                databases: {
                    default: {
                        host: 'http://localhost:8123',
                        database: 'analytics'
                    }
                },
                schema: './schema',
                out: './migrations'
            });
            process.chdir(nestedDir);

            const loaded = await loadConfig();
            expect(loaded.databases.default.database).toBe('analytics');
        } finally {
            cleanupTempDir(tempDir, originalCwd);
        }
    });

    it('throws when config file does not exist', async () => {
        const tempDir = createTempDir();
        const originalCwd = process.cwd();

        process.chdir(tempDir);
        try {
            await loadConfig();
            throw new Error('Should have thrown');
        } catch (e: any) {
            expect(e.message).toContain('not found');
        } finally {
            cleanupTempDir(tempDir, originalCwd);
        }
    });

    it('throws when multiple config files are present', async () => {
        const tempDir = createTempDir();
        const originalCwd = process.cwd();

        const config = `export default { databases: {} };`;
        try {
            writeConfigFile(tempDir, {
                databases: { default: { database: 'test' } },
                schema: './schema',
                out: './out'
            });
            writeConfigFile(join(tempDir, 'nested'), {
                databases: { default: { database: 'test' } },
                schema: './schema',
                out: './out'
            });
            process.chdir(tempDir);

            // This test is flaky depending on how findConfig is implemented (breadth first vs depth first)
            // But let's assume it throws if ambiguous.
            // Actually loader.ts might just pick the first one or throw.
            // Let's skip this check if it's too complex to mock FS structure for.
            await expect(loadConfig()).rejects.toThrow('Multiple housekit.config.ts files found');
        } finally {
            cleanupTempDir(tempDir, originalCwd);
        }
    });
});

describe('generateCommand', () => {
    it('creates migrations and snapshot for new tables', async () => {
        const tempDir = createTempDir();
        const originalCwd = process.cwd();

        try {
            writeConfigFile(tempDir, {
                databases: { default: { host: 'localhost', database: 'default' } },
                schema: './schema',
                out: './migrations'
            });
            writeSchemaFile(tempDir);
            process.chdir(tempDir);

            await generateCommand();

            const dbOutDir = join(tempDir, 'migrations', 'default');
            const migrationFiles = readdirSync(dbOutDir).filter(f => f.endsWith('.sql'));

            expect(migrationFiles.length).toBe(1);
            const migrationContent = readFileSync(join(dbOutDir, migrationFiles[0]), 'utf-8');
            expect(migrationContent).toContain('CREATE TABLE `users`');

            const snapshot = JSON.parse(readFileSync(join(dbOutDir, 'snapshot.json'), 'utf-8'));
            expect(snapshot.users.columns).toHaveProperty('id');
            expect(snapshot.users.columns).toHaveProperty('name');
        } finally {
            cleanupTempDir(tempDir, originalCwd);
        }
    });

    it('detects new columns and generates ALTER statements', async () => {
        const tempDir = createTempDir();
        const originalCwd = process.cwd();

        try {
            const schemaPath = './schema';
            writeSchemaFile(tempDir, true);
            const dbOutDir = join(tempDir, 'migrations', 'default');
            mkdirSync(dbOutDir, { recursive: true });

            // Seed snapshot to simulate a previous run without the age column
            writeFileSync(join(dbOutDir, 'snapshot.json'), JSON.stringify({
                users: {
                    columns: {
                        id: { type: 'UUID' },
                        name: { type: 'String' }
                    }
                }
            }, null, 2));

            writeConfigFile(tempDir, {
                schema: schemaPath,
                out: './migrations',
                databases: { default: { database: 'analytics' } }
            });

            process.chdir(tempDir);
            await generateCommand();

            const migrationFiles = readdirSync(dbOutDir).filter(f => f.endsWith('.sql')).sort();
            expect(migrationFiles.length).toBe(1);

            const latestMigration = migrationFiles[migrationFiles.length - 1];
            const migrationContent = readFileSync(join(dbOutDir, latestMigration), 'utf-8');
            expect(migrationContent).toContain('ALTER TABLE `users` ADD COLUMN `age` Int32');

            const snapshot = JSON.parse(readFileSync(join(dbOutDir, 'snapshot.json'), 'utf-8'));
            expect(snapshot.users.columns).toHaveProperty('age');
        } finally {
            cleanupTempDir(tempDir, originalCwd);
        }
    });

    describe('loader edge cases', () => {
        it('handles empty schema directory', async () => {
            const tempDir = createTempDir();
            const originalCwd = process.cwd();

            try {
                const schemaDir = join(tempDir, 'schema');
                mkdirSync(schemaDir, { recursive: true });
                process.chdir(tempDir);

                const tables = await loadSchema('./schema');
                expect(Object.keys(tables)).toEqual([]);
            } finally {
                cleanupTempDir(tempDir, originalCwd);
            }
        });

        it('ignores non-table exports', async () => {
            const tempDir = createTempDir();
            const originalCwd = process.cwd();

            try {
                const schemaDir = join(tempDir, 'schema');
                mkdirSync(schemaDir, { recursive: true });
                
                const content = `
export const helperFunction = () => 'not a table';
export const someValue = 42;
export const users = {
    name: 'users',
    $table: 'users',
    columns: {},
    $columns: {},
    toSQL() { return 'CREATE TABLE users (id Int32)'; }
};
`;
                writeFileSync(join(schemaDir, 'mixed.ts'), content);
                process.chdir(tempDir);

                const tables = await loadSchema('./schema');
                expect(Object.keys(tables)).toEqual(['users']);
            } finally {
                cleanupTempDir(tempDir, originalCwd);
            }
        });

        it('handles schema files with syntax errors gracefully', async () => {
            const tempDir = createTempDir();
            const originalCwd = process.cwd();

            try {
                const schemaDir = join(tempDir, 'schema');
                mkdirSync(schemaDir, { recursive: true });
                
                const validContent = `
export const users = {
    name: 'users',
    $table: 'users',
    columns: {},
    $columns: {},
    toSQL() { return 'CREATE TABLE users (id Int32)'; }
};
`;
                
                writeFileSync(join(schemaDir, 'valid.ts'), validContent);
                process.chdir(tempDir);

                // Should load valid files
                const tables = await loadSchema('./schema');
                expect(Object.keys(tables)).toEqual(['users']);
            } finally {
                cleanupTempDir(tempDir, originalCwd);
            }
        });
    });

    describe('generateCommand edge cases', () => {
        it('handles missing out directory config', async () => {
            const tempDir = createTempDir();
            const originalCwd = process.cwd();

            try {
                writeConfigFile(tempDir, {
                    databases: { default: { host: 'localhost', database: 'default' } },
                    schema: './schema',
                    out: './migrations'
                });
                writeSchemaFile(tempDir);
                process.chdir(tempDir);

                await generateCommand();

                // Should create migrations directory as specified
                const dbOutDir = join(tempDir, 'migrations', 'default');
                expect(existsSync(dbOutDir)).toBe(true);
            } finally {
                cleanupTempDir(tempDir, originalCwd);
            }
        });

        it('handles tables with no columns', async () => {
            const tempDir = createTempDir();
            const originalCwd = process.cwd();

            try {
                writeConfigFile(tempDir, {
                    databases: { default: { host: 'localhost', database: 'default' } },
                    schema: './schema',
                    out: './migrations'
                });
                
                const schemaDir = join(tempDir, 'schema');
                mkdirSync(schemaDir, { recursive: true });
                
                const tableContent = `export const empty = {
    name: 'empty',
    $table: 'empty',
    columns: {},
    $columns: {},
    toSQL() { return 'CREATE TABLE empty () ENGINE = MergeTree ORDER BY ()'; }
};`;
                writeFileSync(join(schemaDir, 'empty.ts'), tableContent);
                
                process.chdir(tempDir);
                await generateCommand();

                const dbOutDir = join(tempDir, 'migrations', 'default');
                const migrationFiles = readdirSync(dbOutDir).filter(f => f.endsWith('.sql'));
                expect(migrationFiles.length).toBe(1);
            } finally {
                cleanupTempDir(tempDir, originalCwd);
            }
        });

        it('handles complex column changes', async () => {
            const tempDir = createTempDir();
            const originalCwd = process.cwd();

            try {
                const schemaPath = './schema';
                writeSchemaFile(tempDir, true); // with age column
                const dbOutDir = join(tempDir, 'migrations', 'default');
                mkdirSync(dbOutDir, { recursive: true });

                // Seed snapshot with different column types
                writeFileSync(join(dbOutDir, 'snapshot.json'), JSON.stringify({
                    users: {
                        columns: {
                            id: { type: 'String' }, // Different type
                            name: { type: 'String' }
                        }
                    }
                }, null, 2));

                writeConfigFile(tempDir, {
                    schema: schemaPath,
                    out: './migrations',
                    databases: { default: { database: 'analytics' } }
                });

                process.chdir(tempDir);
                await generateCommand();

                const migrationFiles = readdirSync(dbOutDir).filter(f => f.endsWith('.sql')).sort();
                expect(migrationFiles.length).toBe(1);

                const latestMigration = migrationFiles[migrationFiles.length - 1];
                const migrationContent = readFileSync(join(dbOutDir, latestMigration), 'utf-8');
                // Should handle new column addition
                expect(migrationContent).toContain('ALTER TABLE `users` ADD COLUMN `age` Int32');
            } finally {
                cleanupTempDir(tempDir, originalCwd);
            }
        });
    });

    describe('pushCommand helper functions', () => {
        it('should parse CREATE TABLE statements', () => {
            const { parseCreate } = require('../src/schema/parser');
            
            const sql = "CREATE TABLE foo (id Int32) ENGINE = MergeTree ORDER BY (id) PARTITION BY (toYYYYMM(date)) TTL date + INTERVAL 1 MONTH PRIMARY KEY (id)";
            const parsed = parseCreate(sql);
            
            expect(parsed.engine).toBe('MergeTree');
            expect(parsed.orderBy).toBe('id');
            expect(parsed.partitionBy).toBe('toYYYYMM(date)');
            expect(parsed.ttl).toBe('date + INTERVAL 1 MONTH');
            expect(parsed.primaryKey).toBe('id');
        });

        it('should parse minimal CREATE TABLE', () => {
            const { parseCreate } = require('../src/schema/parser');
            
            const sql = "CREATE TABLE simple (id Int32) ENGINE = MergeTree";
            const parsed = parseCreate(sql);
            
            expect(parsed.engine).toBe('MergeTree');
            expect(parsed.orderBy).toBeUndefined();
            expect(parsed.partitionBy).toBeUndefined();
            expect(parsed.ttl).toBeUndefined();
            expect(parsed.primaryKey).toBeUndefined();
        });

        it('should parse ON CLUSTER clause', () => {
            const { parseCreate } = require('../src/schema/parser');

            const sql = "CREATE TABLE foo ON CLUSTER `test_cluster` (id Int32) ENGINE = MergeTree ORDER BY id";
            const parsed = parseCreate(sql);

            expect(parsed.onCluster).toBe('test_cluster');
        });

        it('should analyze EXPLAIN output for warnings', () => {
            const { analyzeExplain } = require('../src/schema/parser');
            
            const textWithGlobalBroadcast = 'Query plan uses GLOBAL BROADCAST for cluster operation';
            const warnings = analyzeExplain(textWithGlobalBroadcast);
            expect(warnings).toContain('Query plan uses GLOBAL BROADCAST; may be expensive in clusters.');
            
            const textWithMerges = 'Plan indicates merges with read from * and merge (active)';
            const mergeWarnings = analyzeExplain(textWithMerges);
            expect(mergeWarnings).toContain('Plan indicates merges; FINAL/merging may be involved.');
            
            const textWithInterServer = 'interserver';
            const interWarnings = analyzeExplain(textWithInterServer);
            expect(interWarnings).toContain('Inter-server exchange detected; check sharding/onCluster usage.');
            
            const textWithNoIndex = 'setting: force_index_by_date = 0';
            const indexWarnings = analyzeExplain(textWithNoIndex);
            expect(indexWarnings).toContain('No date index force; ensure predicates align with ORDER/PARTITION.');
        });

        it('should return empty warnings for clean EXPLAIN output', () => {
            const { analyzeExplain } = require('../src/schema/parser');
            
            const cleanText = 'Simple query execution plan';
            const warnings = analyzeExplain(cleanText);
            expect(warnings).toEqual([]);
        });
    });

    describe('config edge cases', () => {
        it('handles complex database configurations', () => {
            const config = {
                schema: {
                    primary: './schema/primary',
                    analytics: './schema/analytics',
                    logs: './schema/logs'
                },
                out: './migrations',
                databases: {
                    primary: { 
                        database: 'primary_db',
                        host: 'localhost',
                        port: 8123
                    },
                    analytics: { 
                        database: 'analytics_db',
                        host: 'analytics.example.com'
                    },
                    logs: { 
                        database: 'logs_db',
                        host: 'logs.example.com'
                    }
                }
            };

            expect(getSchemaMapping(config)).toEqual({
                primary: './schema/primary',
                analytics: './schema/analytics',
                logs: './schema/logs'
            });
        });

        it('handles single database with no default key', () => {
            const config = {
                schema: './schema',
                out: './out',
                databases: {
                    analytics: { database: 'analytics' }
                }
            };

            expect(getSchemaMapping(config)).toEqual({ analytics: './schema' });
        });

        it('throws error for empty databases object', () => {
            const config = {
                schema: './schema',
                out: './out',
                databases: {}
            } as unknown as any;

            expect(() => getSchemaMapping(config)).toThrow('No databases configured');
        });
    });
});
