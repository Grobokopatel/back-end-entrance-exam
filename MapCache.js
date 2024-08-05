class MapCache {
    // -1 для бесконечной ёмкости кэша
    constructor(capacity = -1) {
        this.validate_capacity(capacity);
        this.capacity = capacity;
        this.count = 0;
        this.cache = new Map();
    }

    get_keys() {
        return [...this.cache.keys()];
    }

    get_value(key) {
        return this.cache.get(key);
    }

    has_key(key) {
        return this.cache.has(key);
    }

    // Возвращает true, если ключ уже был в словаре, либо хватило capacity для его вставки
    add_or_update(key, value) {
        if (this.cache.has(key)) {
            this.cache.set(key, value);
            return true;
        }

        if (this.capacity !== -1 && this.count + 1 > this.capacity) {
            return false;
        }

        this.cache.set(key, value);
        this.count++;
        return true;
    }

    clear() {
        this.cache.clear();
        this.count = 0;
    }

    change_cache_capacity(new_capacity) {
        this.validate_capacity(new_capacity);
        if (new_capacity >= this.count || new_capacity === -1) {
            this.capacity = new_capacity;
            return;
        }

        let keys = this.get_keys();
        for (let i = 0; i < this.count - new_capacity; ++i) {
            this.cache.delete(keys[i]);
        }
        this.count = new_capacity;
        this.capacity = new_capacity;
    }

    validate_capacity(new_capacity) {
        if (new_capacity < -1) {
            throw new TypeError(`Capacity should be greater than or equal -1, got ${capacity}`);
        }
    }

    serialize() {
        let keys = this.get_keys();
        return {count: keys.length, capacity: this.capacity, keys};
    }
}

module.exports = {
    MapCache
};