export class LRUCache<K, V> {
    private map = new Map<K, V>();
    private readonly max: number;

    constructor(options: { max: number }) {
        this.max = options.max;
    }

    get(key: K): V | undefined {
        const item = this.map.get(key);
        if (item !== undefined) {
            // Refresh item
            this.map.delete(key);
            this.map.set(key, item);
        }
        return item;
    }

    set(key: K, value: V): void {
        if (this.map.has(key)) {
            this.map.delete(key);
        } else if (this.map.size >= this.max) {
            // Evict oldest (first item in Map)
            const firstKey = this.map.keys().next().value;
            if (firstKey !== undefined) {
                this.map.delete(firstKey);
            }
        }
        this.map.set(key, value);
    }

    clear(): void {
        this.map.clear();
    }
}
