import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { loadConfig } from '../loader';
import { getDatabaseConfigs } from '../config';
import { error, info, success, warn, quoteName } from '../ui';

interface MigrationIssue {
    type: 'duplicate_timestamp' | 'empty_file' | 'invalid_format' | 'out_of_order' | 'invalid_sql' | 'missing_semicolon' | 'snapshot_mismatch';
    file: string;
    message: string;
    severity: 'error' | 'warning';
}

import { parseStatement } from '../schema/parser';

function validateMigrationFile(file: string, content: string, previousTimestamp?: number): MigrationIssue[] {
    const issues: MigrationIssue[] = [];

    // Check file format: timestamp_name.sql
    const formatMatch = file.match(/^(\d+)_(.+)\.sql$/);
    if (!formatMatch) {
        issues.push({
            type: 'invalid_format',
            file,
            message: `Invalid file format. Expected: timestamp_name.sql`,
            severity: 'error'
        });
        return issues; // Can't validate further if format is wrong
    }

    const timestamp = parseInt(formatMatch[1], 10);
    const name = formatMatch[2];

    // Check if timestamp is valid number
    if (isNaN(timestamp) || timestamp <= 0) {
        issues.push({
            type: 'invalid_format',
            file,
            message: `Invalid timestamp: ${formatMatch[1]}`,
            severity: 'error'
        });
    }

    // Check if out of order
    if (previousTimestamp && timestamp < previousTimestamp) {
        issues.push({
            type: 'out_of_order',
            file,
            message: `Timestamp ${timestamp} is earlier than previous migration`,
            severity: 'warning'
        });
    }

    // Check if empty
    const trimmedContent = content.trim();
    if (!trimmedContent) {
        issues.push({
            type: 'empty_file',
            file,
            message: 'Migration file is empty',
            severity: 'error'
        });
        return issues; // Can't validate SQL if empty
    }

    // Check for semicolons
    if (!trimmedContent.endsWith(';')) {
        issues.push({
            type: 'missing_semicolon',
            file,
            message: 'Migration does not end with semicolon',
            severity: 'warning'
        });
    }

    // Basic SQL validation: split by semicolon and check each statement
    const statements = trimmedContent
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

    if (statements.length === 0) {
        issues.push({
            type: 'invalid_sql',
            file,
            message: 'No valid SQL statements found',
            severity: 'error'
        });
    }

    // Validate each statement
    for (const statement of statements) {
        const parsed = parseStatement(statement);
        if (parsed.type === 'UNKNOWN' && statement.length > 0) {
            // Not a recognized statement type, but might be valid SQL
            // Only warn if it looks suspicious
            if (!statement.match(/^(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|RENAME|TRUNCATE)/i)) {
                issues.push({
                    type: 'invalid_sql',
                    file,
                    message: `Unrecognized statement type: ${statement.substring(0, 50)}...`,
                    severity: 'warning'
                });
            }
        }
    }

    return issues;
}

export async function checkCommand() {
    const config = await loadConfig();
    const databases = getDatabaseConfigs(config);
    const outDir = config.out || './housekit';

    let totalIssues = 0;
    let totalErrors = 0;
    let totalWarnings = 0;

    for (const dbName of Object.keys(databases)) {
        const dbOutDir = join(outDir, dbName);

        if (!existsSync(dbOutDir)) {
            warn(`Migration directory not found for ${quoteName(dbName)}: ${dbOutDir}`);
            continue;
        }

        const files = readdirSync(dbOutDir).filter(f => f.endsWith('.sql')).sort();

        if (files.length === 0) {
            info(`No migrations found for ${quoteName(dbName)}`);
            continue;
        }

        console.log();
        info(`Checking migrations for ${quoteName(dbName)} (${files.length} file${files.length === 1 ? '' : 's'})`);

        const seenTimestamps = new Set<string>();
        const allIssues: MigrationIssue[] = [];
        let previousTimestamp: number | undefined;

        for (const file of files) {
            const filePath = join(dbOutDir, file);
            const content = readFileSync(filePath, 'utf-8');

            // Extract timestamp for duplicate check
            const timestampMatch = file.match(/^(\d+)_/);
            if (timestampMatch) {
                const timestamp = timestampMatch[1];
                if (seenTimestamps.has(timestamp)) {
                    allIssues.push({
                        type: 'duplicate_timestamp',
                        file,
                        message: `Duplicate timestamp: ${timestamp}`,
                        severity: 'error'
                    });
                } else {
                    seenTimestamps.add(timestamp);
                }
            }

            // Validate file
            const fileIssues = validateMigrationFile(file, content, previousTimestamp);
            allIssues.push(...fileIssues);

            // Update previous timestamp for ordering check
            if (timestampMatch) {
                const timestamp = parseInt(timestampMatch[1], 10);
                if (!isNaN(timestamp) && (!previousTimestamp || timestamp > previousTimestamp)) {
                    previousTimestamp = timestamp;
                }
            }
        }

        // Check snapshot.json if it exists
        const snapshotPath = join(dbOutDir, 'snapshot.json');
        if (existsSync(snapshotPath)) {
            try {
                const snapshot = JSON.parse(readFileSync(snapshotPath, 'utf-8'));
                const snapshotTables = Object.keys(snapshot);

                // Check if snapshot tables match migrations
                // This is a basic check - could be enhanced
                if (snapshotTables.length === 0 && files.length > 0) {
                    allIssues.push({
                        type: 'snapshot_mismatch',
                        file: 'snapshot.json',
                        message: 'Snapshot is empty but migrations exist',
                        severity: 'warning'
                    });
                }
            } catch (e) {
                allIssues.push({
                    type: 'snapshot_mismatch',
                    file: 'snapshot.json',
                    message: `Invalid JSON: ${String(e)}`,
                    severity: 'error'
                });
            }
        }

        // Group and display issues
        const errors = allIssues.filter(i => i.severity === 'error');
        const warnings = allIssues.filter(i => i.severity === 'warning');

        if (errors.length > 0) {
            console.log();
            error(`Errors (${errors.length}):`);
            errors.forEach(issue => {
                error(`  ✗ ${quoteName(issue.file)}: ${issue.message}`);
            });
        }

        if (warnings.length > 0) {
            console.log();
            warn(`Warnings (${warnings.length}):`);
            warnings.forEach(issue => {
                warn(`  ⚠ ${quoteName(issue.file)}: ${issue.message}`);
            });
        }

        if (errors.length === 0 && warnings.length === 0) {
            success(`✓ All migrations valid for ${quoteName(dbName)}`);
        }

        totalIssues += allIssues.length;
        totalErrors += errors.length;
        totalWarnings += warnings.length;
    }

    console.log();
    if (totalIssues === 0) {
        success('✓ No migration issues detected');
    } else {
        const summary = [];
        if (totalErrors > 0) summary.push(`${totalErrors} error${totalErrors === 1 ? '' : 's'}`);
        if (totalWarnings > 0) summary.push(`${totalWarnings} warning${totalWarnings === 1 ? '' : 's'}`);
        error(`Found ${summary.join(' and ')} in migrations`);
    }
}
