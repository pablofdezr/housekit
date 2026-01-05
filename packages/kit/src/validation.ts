import { existsSync } from 'fs';
import { resolve } from 'path';
import type { HouseKitConfig } from './config';

export interface ValidationError {
    field: string;
    message: string;
    severity: 'error' | 'warning';
}

export interface ValidationResult {
    valid: boolean;
    errors: ValidationError[];
    warnings: ValidationError[];
}

export interface ValidateConfigOptions {
    rootDir?: string;
    skipPathValidation?: boolean;
}

/**
 * Validate HouseKit configuration
 */
export function validateConfig(config: HouseKitConfig, options: ValidateConfigOptions = {}): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];
    const rootDir = options.rootDir || process.cwd();

    validateRequiredFields(config, errors);
    if (!options.skipPathValidation) {
        validateSchemaPath(config, rootDir, errors, warnings);
        validateOutPath(config, rootDir, errors, warnings);
    }
    validateDatabases(config, errors, warnings);
    validateSchemaMapping(config, errors, warnings);

    return {
        valid: errors.length === 0,
        errors,
        warnings
    };
}

function validateRequiredFields(config: HouseKitConfig, errors: ValidationError[]) {
    if (!config.schema) {
        errors.push({
            field: 'schema',
            message: 'Schema path is required',
            severity: 'error'
        });
    }

    if (!config.out) {
        errors.push({
            field: 'out',
            message: 'Output directory is required',
            severity: 'error'
        });
    }

    if (!config.databases || Object.keys(config.databases).length === 0) {
        errors.push({
            field: 'databases',
            message: 'At least one database must be configured',
            severity: 'error'
        });
    }
}

function validateSchemaPath(config: HouseKitConfig, rootDir: string, errors: ValidationError[], warnings: ValidationError[]) {
    const schemaPath = typeof config.schema === 'string' ? config.schema : Object.values(config.schema)[0];

    if (!schemaPath) return;

    const fullPath = resolve(rootDir, schemaPath);

    if (!existsSync(fullPath)) {
        warnings.push({
            field: 'schema',
            message: `Schema directory does not exist: ${schemaPath}`,
            severity: 'warning'
        });
    }
}

function validateOutPath(config: HouseKitConfig, rootDir: string, errors: ValidationError[], warnings: ValidationError[]) {
    const fullPath = resolve(rootDir, config.out);

    if (!existsSync(fullPath)) {
        warnings.push({
            field: 'out',
            message: `Output directory does not exist: ${config.out}`,
            severity: 'warning'
        });
    }
}

function validateDatabases(config: HouseKitConfig, errors: ValidationError[], warnings: ValidationError[]) {
    if (!config.databases) return;

    for (const [name, db] of Object.entries(config.databases)) {
        const prefix = `databases.${name}`;

        if (!db.database) {
            errors.push({
                field: `${prefix}.database`,
                message: `Database name is required for "${name}"`,
                severity: 'error'
            });
        }

        if (db.url && db.host) {
            warnings.push({
                field: `${prefix}`,
                message: `Both url and host are specified for "${name}". Using url.`,
                severity: 'warning'
            });
        }

        if (db.port !== undefined && (db.port < 1 || db.port > 65535)) {
            errors.push({
                field: `${prefix}.port`,
                message: `Invalid port ${db.port} for "${name}". Port must be between 1 and 65535.`,
                severity: 'error'
            });
        }

        if (!db.url && !db.host) {
            warnings.push({
                field: `${prefix}`,
                message: `No url or host specified for "${name}". Using default http://localhost:8123.`,
                severity: 'warning'
            });
        }
    }
}

function validateSchemaMapping(config: HouseKitConfig, errors: ValidationError[], warnings: ValidationError[]) {
    if (typeof config.schema !== 'string' && config.schema) {
        const schemaDatabases = Object.keys(config.schema);
        const configDatabases = Object.keys(config.databases || {});

        const missingInSchema = configDatabases.filter(db => !schemaDatabases.includes(db));
        const missingInConfig = schemaDatabases.filter(db => !configDatabases.includes(db));

        if (missingInSchema.length > 0) {
            errors.push({
                field: 'schema',
                message: `Databases defined in config but not in schema mapping: ${missingInSchema.join(', ')}`,
                severity: 'error'
            });
        }

        if (missingInConfig.length > 0) {
            warnings.push({
                field: 'schema',
                message: `Databases defined in schema mapping but not in config: ${missingInConfig.join(', ')}`,
                severity: 'warning'
            });
        }
    }
}
