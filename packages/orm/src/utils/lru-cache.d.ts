export declare class LRUCache<K, V> {
    private map;
    private readonly max;
    constructor(options: {
        max: number;
    });
    get(key: K): V | undefined;
    set(key: K, value: V): void;
    clear(): void;
}
