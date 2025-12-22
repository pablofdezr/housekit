import { existsSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { loadConfig } from '../loader';
import { error, info, success, warn, inputPrompt, confirmPrompt, quoteName, listPrompt } from '../ui';

export async function initCommand() {
    const schemaDir = './src/schema';
    const migrationsDir = './housekit';

    // Check if config already exists
    if (existsSync('housekit.config.js') ||
        existsSync('housekit.config.ts') ||
        existsSync('housekit.config.mjs') ||
        existsSync('housekit.config.cjs')) {
        const overwrite = await confirmPrompt('Configuration file already exists. Overwrite?', false);
        if (!overwrite) {
            info('Initialization cancelled.');
            return;
        }
    }

    // Gather configuration
    info('Let\'s set up your HouseKit project!');
    console.log();

    const fileType = await listPrompt<'js' | 'ts'>(
        'Choose file type',
        [
            { name: 'JavaScript (.js)', value: 'js' },
            { name: 'TypeScript (.ts)', value: 'ts' }
        ],
        'js'
    );
    console.log();

    const clickhouseUrl = await inputPrompt(
        'ClickHouse URL',
        'http://localhost:8123',
        (input) => {
            if (!input.trim()) {
                return 'URL is required';
            }
            return true;
        }
    );

    const database = await inputPrompt(
        'Database name',
        'default'
    );

    const username = await inputPrompt(
        'Username',
        'default'
    );

    const password = await inputPrompt(
        'Password',
        '',
        () => true
    );

    const schemaPath = await inputPrompt(
        'Schema directory',
        schemaDir
    );

    const migrationsPath = await inputPrompt(
        'Migrations output directory',
        migrationsDir
    );

    // Create config file
    const configPath = `housekit.config.${fileType}`;
    const configContent = fileType === 'ts'
        ? `import type { HouseKitConfig } from 'housekit';

export default {
    schema: "${schemaPath}",
    out: "${migrationsPath}",
    language: "${fileType}",
    databases: {
        default: {
            url: "${clickhouseUrl}",
            database: "${database}",
            username: "${username}",
            // We recommend using environment variables for sensitive credentials
            password: process.env.CLICKHOUSE_PASSWORD || "" // Recommended: set this in your .env file
        }
    }
} satisfies HouseKitConfig;
`
        : `export default {
    schema: "${schemaPath}",
    out: "${migrationsPath}",
    language: "${fileType}",
    databases: {
        default: {
            url: "${clickhouseUrl}",
            database: "${database}",
            username: "${username}",
            // We recommend using environment variables for sensitive credentials
            password: process.env.CLICKHOUSE_PASSWORD || "" // Recommended: set this in your .env file
        }
    }
};
`;

    writeFileSync(configPath, configContent);
    success(`Created ${quoteName(configPath)}`);

    // Create schema directory
    if (!existsSync(schemaPath)) {
        mkdirSync(schemaPath, { recursive: true });
        success(`Created schema directory: ${quoteName(schemaPath)}`);

        // Create example schema file
        const exampleSchemaPath = join(schemaPath, `logs.${fileType}`);
        const exampleSchemaContent = `// Example table - This is a sample schema file to demonstrate HouseKit usage
import { t, defineTable, Engine } from '@housekit/orm';

export const logs = defineTable('logs', (t) => ({
    id: t.uuid('id').autoGenerate().primaryKey(),
    message: t.text('message').comment('Log message content'),
    level: t.enum('level', ['info', 'warning', 'error']).default('info').comment('Log severity level'),
    tags: t.array(t.text('tag')).nullable().comment('Array of tags for categorizing logs'),
    metadata: t.json('metadata').nullable().comment('Additional log metadata'),
    createdAt: t.timestamp('created_at').default('now()'),
}), {
    engine: Engine.MergeTree(),
    orderBy: ['createdAt', 'id'],
    appendOnly: false,
    metadataVersion: "1.2.0"
});
`;

        writeFileSync(exampleSchemaPath, exampleSchemaContent);
        info(`Created example schema: ${quoteName(exampleSchemaPath)}`);
    } else {
        info(`Schema directory already exists: ${quoteName(schemaPath)}`);
    }

    // Create migrations directory
    if (!existsSync(migrationsPath)) {
        mkdirSync(migrationsPath, { recursive: true });
        success(`Created migrations directory: ${quoteName(migrationsPath)}`);
    } else {
        info(`Migrations directory already exists: ${quoteName(migrationsPath)}`);
    }

    console.log();
    success('HouseKit project initialized successfully!');
    console.log();
    info('Next steps:');
    info('  1. Install dependencies: bun add @housekit/orm');
    info('  2. Edit your schema files in: ' + schemaPath);
    info('  3. Generate migrations: bunx housekit generate');
    info('  4. Apply migrations: bunx housekit migrate');
}
