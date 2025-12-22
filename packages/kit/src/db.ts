import { createClient, type ClickHouseClient } from '@clickhouse/client';
import { getSchemaMapping, type HouseKitConfig } from './config';

export interface ResolvedDatabase {
    name: string;
    client: ClickHouseClient;
    schemaPath?: string;
}

function pickDatabase(config: HouseKitConfig, name?: string) {
    if (name && config.databases[name]) {
        return { name, db: config.databases[name] };
    }

    if (config.databases.default) {
        return { name: 'default', db: config.databases.default };
    }

    const first = Object.entries(config.databases)[0];
    if (first) {
        return { name: first[0], db: first[1] };
    }

    throw new Error('No databases configured');
}

export function resolveDatabase(config: HouseKitConfig, name?: string): ResolvedDatabase {
    const selected = pickDatabase(config, name);
    // Prefer url over host to avoid deprecation warning
    // If host is provided without protocol, add http:// prefix
    let url = selected.db.url;
    if (!url && selected.db.host) {
        url = selected.db.host.startsWith('http://') || selected.db.host.startsWith('https://')
            ? selected.db.host
            : `http://${selected.db.host}`;
    }
    url = url || 'http://localhost:8123';

    const client = createClient({
        url,
        username: selected.db.username || 'default',
        password: selected.db.password || '',
        database: selected.db.database || 'default'
    });

    const schemaMapping = getSchemaMapping(config);
    const schemaPath = schemaMapping[selected.name];

    return { name: selected.name, client, schemaPath };
}
