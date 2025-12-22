import { describe, it, expect, spyOn, mock, beforeAll, afterAll, afterEach, beforeEach } from 'bun:test';
import { diffTable } from '../src/schema/diff';
import { analyzeExplain, parseCreate } from '../src/schema/parser';
import { pushCommand } from '../src/commands/push';
import * as loader from '../src/loader';
import * as db from '../src/db';
import * as ui from '../src/ui';
import { defineTable, t, Engine } from '@housekit/orm';
import * as fs from 'fs';

describe('Push Command', () => {
    let uiInfoSpy: any, uiWarnSpy: any, uiErrorSpy: any, uiSuccessSpy: any, uiSpinnerSpy: any, uiConfirmSpy: any;
    let loadConfigSpy: any;
    let resolveDbSpy: any;

    const mockConfig = {
        databases: { default: { host: 'http://localhost:8123', database: 'default' } },
        schema: './schema',
        out: './migrations'
    };

    const mockClient = {
        query: mock(),
        command: mock(),
        close: mock()
    };

    beforeEach(() => {
        mockClient.query = mock();
        mockClient.command = mock();
        mockClient.close = mock();

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
        uiConfirmSpy = spyOn(ui, 'confirmPrompt').mockResolvedValue(true);

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
        uiConfirmSpy.mockRestore();
        loadConfigSpy.mockRestore();
        resolveDbSpy.mockRestore();
    });

    describe('Helpers', () => {
        it('should parse CREATE TABLE statements', () => {
            const sql = "CREATE TABLE foo (id Int32) ENGINE = MergeTree ORDER BY (id) PARTITION BY (toYYYYMM(date)) TTL date + INTERVAL 1 MONTH PRIMARY KEY (id)";
            const parsed = parseCreate(sql);
            expect(parsed.engine).toBe('MergeTree');
            expect(parsed.orderBy).toBe('id');
            expect(parsed.partitionBy).toBe('toYYYYMM(date)');
            expect(parsed.ttl).toBe('date + INTERVAL 1 MONTH');
            expect(parsed.primaryKey).toBe('id');
        });

        it('should analyze EXPLAIN output', () => {
            const warnings = analyzeExplain('GLOBAL BROADCAST read from *');
            expect(warnings).toContain('Query plan uses GLOBAL BROADCAST; may be expensive in clusters.');
            expect(warnings).toContain('Plan indicates merges; FINAL/merging may be involved.');
        });

        it('should diff tables correctly', () => {
            const localTable = defineTable('users', (t) => ({
                id: t.int32('id'),
                name: t.string('name')
            }), { engine: Engine.MergeTree(), orderBy: 'id' });

            const remote = {
                columns: { id: 'Int32' }, // Missing name
                defaults: {},
                options: { engine: 'MergeTree', orderBy: 'id' },
                comment: null
            };

            const diff = diffTable(localTable, localTable.$columns, remote);
            expect(diff.plan.some(stmt => stmt.includes('ADD COLUMN `name` String'))).toBe(true);
        });
    });

    describe('pushCommand Flow', () => {
        it('should create new table if not exists', async () => {
            // Mock loadSchema
            const mockTable = defineTable('new_table', (t) => ({ id: t.int32('id') }), { engine: Engine.MergeTree(), orderBy: 'id' });
            spyOn(loader, 'loadSchema').mockResolvedValue({ new_table: mockTable });

            // Mock describeTable (remote) -> null (not found)
            mockClient.query.mockRejectedValueOnce(new Error('Table not found'));

            // Mock EXPLAIN
            mockClient.query.mockResolvedValueOnce({ text: async () => 'Plan' } as any);

            // Mock Create
            mockClient.command.mockResolvedValue({});

            await pushCommand({ logExplain: true });

            expect(mockClient.command).toHaveBeenCalled();
            expect(ui.success).toHaveBeenCalled();
        });

        it('should skip externally managed tables', async () => {
            const mockTable = defineTable('ext_table', (t) => ({ id: t.int32('id') }), { engine: Engine.MergeTree(), orderBy: 'id', externallyManaged: true });
            spyOn(loader, 'loadSchema').mockResolvedValue({ ext_table: mockTable });

            await pushCommand({});
            expect(ui.info).toHaveBeenCalledWith(expect.stringContaining('Skipping externally managed'));
        });

        it('should handle schema drift (add column)', async () => {
            const mockTable = defineTable('users', (t) => ({ id: t.int32('id'), age: t.int32('age') }), { engine: Engine.MergeTree(), orderBy: 'id' });
            spyOn(loader, 'loadSchema').mockResolvedValue({ users: mockTable });

            // Mock describeTable (remote) -> exists but missing age
            mockClient.query.mockResolvedValueOnce({
                json: async () => [{ name: 'id', type: 'Int32' }]
            } as any); // DESCRIBE
            mockClient.query.mockResolvedValueOnce({
                json: async () => [{ statement: 'CREATE TABLE users (id Int32) ENGINE = MergeTree ORDER BY id' }]
            } as any); // SHOW CREATE
            mockClient.query.mockResolvedValueOnce({
                json: async () => [{ cnt: 100 }]
            } as any); // COUNT

            // Mock EXPLAIN
            mockClient.query.mockResolvedValueOnce({ text: async () => 'Plan' } as any);

            await pushCommand({ logExplain: true });

            const calls = (mockClient.command as any).mock.calls || [];
            const hasAgeChange = calls.some((call: any[]) => call[0]?.query?.includes('`age` Int32'));
            expect(hasAgeChange).toBe(true);
        });

        it('should not write explain logs by default', async () => {
            const mockTable = defineTable('new_table', (t) => ({ id: t.int32('id') }), { engine: Engine.MergeTree(), orderBy: 'id' });
            spyOn(loader, 'loadSchema').mockResolvedValue({ new_table: mockTable });
            mockClient.query.mockRejectedValueOnce(new Error('Table not found'));
            mockClient.command.mockResolvedValue({});

            const writeSpy = spyOn(fs, 'writeFileSync').mockImplementation(() => undefined as any);

            await pushCommand({});

            expect(writeSpy).not.toHaveBeenCalled();
            writeSpy.mockRestore();
        });

        it('should write explain logs when enabled', async () => {
            const mockTable = defineTable('new_table', (t) => ({ id: t.int32('id') }), { engine: Engine.MergeTree(), orderBy: 'id' });
            spyOn(loader, 'loadSchema').mockResolvedValue({ new_table: mockTable });
            mockClient.query.mockRejectedValueOnce(new Error('Table not found'));
            mockClient.command.mockResolvedValue({});

            const mkdirSpy = spyOn(fs, 'mkdirSync').mockImplementation(() => undefined as any);
            const writeSpy = spyOn(fs, 'writeFileSync').mockImplementation(() => undefined as any);

            await pushCommand({ logExplain: true });

            expect(writeSpy).toHaveBeenCalled();

            mkdirSpy.mockRestore();
            writeSpy.mockRestore();
        });
    });
});
