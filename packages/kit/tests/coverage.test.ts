import { describe, it, expect, spyOn, mock } from 'bun:test';
import * as ui from '../src/ui';
import * as db from '../src/db';
import type { HouseKitConfig } from '../src/config';
import inquirer from 'inquirer';

describe('UI Helpers', () => {
    it('should format messages correctly', () => {
        expect(ui.format('test')).toContain('[housekit] test');
    });

    it('should log info', () => {
        const logSpy = spyOn(console, 'log').mockImplementation(() => { });
        ui.info('test info');
        expect(logSpy).toHaveBeenCalled();
        expect(logSpy.mock.calls[0][0]).toContain('test info');
        logSpy.mockRestore();
    });

    it('should log warning', () => {
        const warnSpy = spyOn(console, 'warn').mockImplementation(() => { });
        ui.warn('test warn');
        expect(warnSpy).toHaveBeenCalled();
        expect(warnSpy.mock.calls[0][0]).toContain('test warn');
        warnSpy.mockRestore();
    });

    it('should log success', () => {
        const logSpy = spyOn(console, 'log').mockImplementation(() => { });
        ui.success('test success');
        expect(logSpy).toHaveBeenCalled();
        expect(logSpy.mock.calls[0][0]).toContain('test success');
        logSpy.mockRestore();
    });

    it('should log error', () => {
        const errorSpy = spyOn(console, 'error').mockImplementation(() => { });
        ui.error('test error');
        expect(errorSpy).toHaveBeenCalled();
        expect(errorSpy.mock.calls[0][0]).toContain('test error');
        errorSpy.mockRestore();
    });

    it('should create spinner', () => {
        const spinner = ui.createSpinner('loading');
        expect(spinner).toBeDefined();
        expect(spinner.start).toBeDefined();
    });

    it('should auto-confirm when global yes is enabled', async () => {
        ui.setGlobalYesMode(true);
        const promptSpy = spyOn(inquirer, 'prompt');
        const result = await ui.confirmPrompt('Are you sure?');
        expect(result).toBe(true);
        expect(promptSpy).not.toHaveBeenCalled();
        ui.setGlobalYesMode(false);
        promptSpy.mockRestore();
    });

    it('should delegate to inquirer when not auto-confirming', async () => {
        const promptSpy = spyOn(inquirer, 'prompt').mockResolvedValue({ ok: false } as any);
        const result = await ui.confirmPrompt('Proceed?', true);
        expect(result).toBe(false);
        promptSpy.mockRestore();
    });
});

describe('DB Helpers', () => {
    const mockConfig: HouseKitConfig = {
        databases: {
            default: { host: 'http://localhost:8123', database: 'default' },
            analytics: { host: 'http://localhost:8123', database: 'analytics' }
        },
        schema: './schema',
        out: './migrations'
    };

    it('should resolve default database', () => {
        const resolved = db.resolveDatabase(mockConfig);
        expect(resolved.name).toBe('default');
        expect(resolved.client).toBeDefined();
        expect(resolved.schemaPath).toBe('./schema');
    });

    it('should resolve specific database', () => {
        const resolved = db.resolveDatabase(mockConfig, 'analytics');
        expect(resolved.name).toBe('analytics');
        expect(resolved.client).toBeDefined();
    });

    it('should fallback to first database if no default', () => {
        const noDefaultConfig: HouseKitConfig = {
            databases: {
                other: { host: 'http://localhost:8123', database: 'other' }
            },
            schema: './schema',
            out: './migrations'
        };
        const resolved = db.resolveDatabase(noDefaultConfig);
        expect(resolved.name).toBe('other');
    });

    it('should throw if no databases configured', () => {
        const emptyConfig: HouseKitConfig = {
            databases: {},
            schema: './schema',
            out: './migrations'
        };
        expect(() => db.resolveDatabase(emptyConfig)).toThrow('No databases configured');
    });
});
