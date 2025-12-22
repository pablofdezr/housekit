import { describe, it, expect, spyOn, mock, beforeAll, afterAll, afterEach, beforeEach } from 'bun:test';
import { checkCommand } from '../src/commands/check';
import { migrateCommand } from '../src/commands/migrate';
import { pullCommand } from '../src/commands/pull';
import { schemaCommand } from '../src/commands/schema';
import * as fs from 'fs';
import * as path from 'path';
import * as loader from '../src/loader';
import * as db from '../src/db';
import * as ui from '../src/ui';

describe('Commands', () => {
    let uiInfoSpy: any, uiWarnSpy: any, uiErrorSpy: any, uiSuccessSpy: any, uiSpinnerSpy: any;
    let loadConfigSpy: any;
    let resolveDbSpy: any;

    // Mock Config
    const mockConfig = {
        databases: { default: { host: 'http://localhost:8123' } },
        schema: './schema',
        out: './migrations'
    };

    // Mock Client
    const mockClient = {
        query: mock(),
        command: mock(),
        close: mock()
    };

    beforeEach(() => {
        // Mock UI to avoid cluttering output
        uiInfoSpy = spyOn(ui, 'info').mockImplementation(() => { });
        uiWarnSpy = spyOn(ui, 'warn').mockImplementation(() => { });
        uiErrorSpy = spyOn(ui, 'error').mockImplementation(() => { });
        uiSuccessSpy = spyOn(ui, 'success').mockImplementation(() => { });
        uiSpinnerSpy = spyOn(ui, 'createSpinner').mockReturnValue({
            start: () => { },
            succeed: () => { },
            fail: () => { },
            warn: () => { }
        } as any);

        loadConfigSpy = spyOn(loader, 'loadConfig').mockResolvedValue(mockConfig as any);

        resolveDbSpy = spyOn(db, 'resolveDatabase').mockReturnValue({
            name: 'default',
            client: mockClient as any,
            schemaPath: './schema'
        });
    });

    afterEach(() => {
        uiInfoSpy.mockRestore();
        uiWarnSpy.mockRestore();
        uiErrorSpy.mockRestore();
        uiSuccessSpy.mockRestore();
        uiSpinnerSpy.mockRestore();
        loadConfigSpy.mockRestore();
        resolveDbSpy.mockRestore();
    });

    describe('checkCommand', () => {
        it('should detect duplicate timestamps', async () => {
            const readdirSpy = spyOn(fs, 'readdirSync').mockReturnValue(['123_a.sql', '123_b.sql'] as any);
            const readFileSpy = spyOn(fs, 'readFileSync').mockReturnValue('SELECT 1');

            const warnSpy = spyOn(ui, 'warn');
            await checkCommand();
            expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Duplicate timestamp'));
            readdirSpy.mockRestore();
            readFileSpy.mockRestore();
        });

        it('should detect empty files', async () => {
            const readdirSpy = spyOn(fs, 'readdirSync').mockReturnValue(['123_a.sql'] as any);
            const readFileSpy = spyOn(fs, 'readFileSync').mockReturnValue('   '); // Empty

            const warnSpy = spyOn(ui, 'warn');
            await checkCommand();
            expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Empty migration file'));
            readdirSpy.mockRestore();
            readFileSpy.mockRestore();
        });

        it('should pass when no issues', async () => {
            const readdirSpy = spyOn(fs, 'readdirSync').mockReturnValue(['123_a.sql'] as any);
            const readFileSpy = spyOn(fs, 'readFileSync').mockReturnValue('SELECT 1');

            const successSpy = spyOn(ui, 'success');
            await checkCommand();
            expect(successSpy).toHaveBeenCalledWith('No migration issues detected.');
            readdirSpy.mockRestore();
            readFileSpy.mockRestore();
        });
    });

    describe('migrateCommand', () => {
        it('should warn if no migrations', async () => {
            const readdirSpy = spyOn(fs, 'readdirSync').mockReturnValue([] as any);
            const warnSpy = spyOn(ui, 'warn');
            await migrateCommand({});
            expect(warnSpy).toHaveBeenCalledWith('No migration files found.');
            readdirSpy.mockRestore();
        });

        it('should apply migrations', async () => {
            const readdirSpy = spyOn(fs, 'readdirSync').mockReturnValue(['123_init.sql'] as any);
            const readFileSpy = spyOn(fs, 'readFileSync').mockReturnValue('CREATE TABLE foo');
            mockClient.command.mockResolvedValue({});

            await migrateCommand({});
            expect(mockClient.command).toHaveBeenCalled();
            readdirSpy.mockRestore();
            readFileSpy.mockRestore();
        });

        it('should handle migration failure', async () => {
            const readdirSpy = spyOn(fs, 'readdirSync').mockReturnValue(['123_fail.sql'] as any);
            const readFileSpy = spyOn(fs, 'readFileSync').mockReturnValue('BAD SQL');
            mockClient.command.mockRejectedValue(new Error('SQL Error'));

            await expect(migrateCommand({})).rejects.toThrow('SQL Error');
            readdirSpy.mockRestore();
            readFileSpy.mockRestore();
        });
    });

    describe('pullCommand', () => {
        it('should pull schema', async () => {
            mockClient.query.mockResolvedValueOnce({
                json: async () => [{ name: 'users' }]
            } as any); // SHOW TABLES

            mockClient.query.mockResolvedValueOnce({
                json: async () => [
                    { name: 'id', type: 'UInt64' },
                    { name: 'name', type: 'String' }
                ]
            } as any); // DESCRIBE users

            const existsSpy = spyOn(fs, 'existsSync').mockReturnValue(true);
            const writeSpy = spyOn(fs, 'writeFileSync').mockImplementation(() => { });

            await pullCommand({});
            expect(writeSpy).toHaveBeenCalled();
            expect(writeSpy.mock.calls[0][0]).toContain('users.ts');
            expect(writeSpy.mock.calls[0][1]).toContain('defineTable(\'users\'');
            existsSpy.mockRestore();
            writeSpy.mockRestore();
        });

        it('should warn if no tables', async () => {
            mockClient.query.mockResolvedValueOnce({
                json: async () => []
            } as any);

            await pullCommand({});
            // Spinner warn is mocked
        });
    });

    describe('schemaCommand', () => {
        it('should display schema', async () => {
            mockClient.query.mockResolvedValueOnce({
                json: async () => [{ name: 'users' }]
            } as any);

            mockClient.query.mockResolvedValueOnce({
                json: async () => [
                    { name: 'id', type: 'UInt64', default_expression: '', comment: '' }
                ]
            } as any);

            const logSpy = spyOn(console, 'log').mockImplementation(() => { });
            await schemaCommand({});
            expect(logSpy).toHaveBeenCalled();
        });
    });
});
