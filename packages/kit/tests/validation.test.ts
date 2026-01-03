import { describe, it, expect } from 'bun:test';
import { validateConfig } from '../src/validation';
import type { HouseKitConfig } from '../src/config';

describe('Config Validation', () => {
    it('should pass with valid single schema configuration', () => {
        const config: HouseKitConfig = {
            schema: './schema',
            out: './migrations',
            databases: {
                default: {
                    host: 'http://localhost:8123',
                    database: 'default'
                }
            }
        };

        const result = validateConfig(config, { skipPathValidation: true });
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    it('should pass with valid multiple schema configuration', () => {
        const config: HouseKitConfig = {
            schema: {
                default: './schema/default',
                analytics: './schema/analytics'
            },
            out: './migrations',
            databases: {
                default: {
                    host: 'http://localhost:8123',
                    database: 'default'
                },
                analytics: {
                    host: 'http://localhost:8123',
                    database: 'analytics'
                }
            }
        };

        const result = validateConfig(config, { skipPathValidation: true });
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    it('should fail when schema is missing', () => {
        const config: HouseKitConfig = {
            schema: '',
            out: './migrations',
            databases: {
                default: {
                    host: 'http://localhost:8123',
                    database: 'default'
                }
            }
        };

        const result = validateConfig(config, { skipPathValidation: true });
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.field === 'schema' && e.message.includes('required'))).toBe(true);
    });

    it('should fail when out is missing', () => {
        const config: HouseKitConfig = {
            schema: './schema',
            out: '',
            databases: {
                default: {
                    host: 'http://localhost:8123',
                    database: 'default'
                }
            }
        };

        const result = validateConfig(config, { skipPathValidation: true });
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.field === 'out' && e.message.includes('required'))).toBe(true);
    });

    it('should fail when databases is empty', () => {
        const config: HouseKitConfig = {
            schema: './schema',
            out: './migrations',
            databases: {}
        };

        const result = validateConfig(config, { skipPathValidation: true });
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.field === 'databases' && e.message.includes('configured'))).toBe(true);
    });

    it('should fail when database name is missing', () => {
        const config: HouseKitConfig = {
            schema: './schema',
            out: './migrations',
            databases: {
                default: {
                    host: 'http://localhost:8123',
                    database: ''
                }
            }
        };

        const result = validateConfig(config, { skipPathValidation: true });
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.field.includes('database') && e.message.includes('required'))).toBe(true);
    });

    it('should warn when port is invalid', () => {
        const config: HouseKitConfig = {
            schema: './schema',
            out: './migrations',
            databases: {
                default: {
                    host: 'http://localhost:8123',
                    port: 99999,
                    database: 'default'
                }
            }
        };

        const result = validateConfig(config, { skipPathValidation: true });
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.field.includes('port') && e.message.includes('Invalid port'))).toBe(true);
    });

    it('should warn when both url and host are specified', () => {
        const config: HouseKitConfig = {
            schema: './schema',
            out: './migrations',
            databases: {
                default: {
                    url: 'http://localhost:8123',
                    host: 'http://localhost:8123',
                    database: 'default'
                }
            }
        };

        const result = validateConfig(config, { skipPathValidation: true });
        expect(result.warnings.some(e => e.field.includes('default') && e.message.includes('Both url and host'))).toBe(true);
    });

    it('should warn when no url or host specified', () => {
        const config: HouseKitConfig = {
            schema: './schema',
            out: './migrations',
            databases: {
                default: {
                    database: 'default'
                }
            }
        };

        const result = validateConfig(config, { skipPathValidation: true });
        expect(result.warnings.some(e => e.field.includes('default') && e.message.includes('No url or host'))).toBe(true);
    });

    it('should fail when config has databases not in schema mapping', () => {
        const config: HouseKitConfig = {
            schema: {
                default: './schema/default'
            },
            out: './migrations',
            databases: {
                default: {
                    host: 'http://localhost:8123',
                    database: 'default'
                },
                analytics: {
                    host: 'http://localhost:8123',
                    database: 'analytics'
                }
            }
        };

        const result = validateConfig(config, { skipPathValidation: true });
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.field === 'schema' && e.message.includes('not in schema mapping'))).toBe(true);
    });

    it('should warn when schema mapping has databases not in config', () => {
        const config: HouseKitConfig = {
            schema: {
                default: './schema/default',
                analytics: './schema/analytics'
            },
            out: './migrations',
            databases: {
                default: {
                    host: 'http://localhost:8123',
                    database: 'default'
                }
            }
        };

        const result = validateConfig(config, { skipPathValidation: true });
        expect(result.warnings.some(e => e.field === 'schema' && e.message.includes('not in config'))).toBe(true);
    });

    it('should warn when config has databases not in schema mapping', () => {
        const config: HouseKitConfig = {
            schema: {
                default: './schema/default'
            },
            out: './migrations',
            databases: {
                default: {
                    host: 'http://localhost:8123',
                    database: 'default'
                },
                analytics: {
                    host: 'http://localhost:8123',
                    database: 'analytics'
                }
            }
        };

        const result = validateConfig(config, { skipPathValidation: true });
        expect(result.errors.some(e => e.field === 'schema' && e.message.includes('not in schema mapping'))).toBe(true);
    });
});
