class MapCache {
    constructor() {
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


    update(key, value) {
        return this.cache.set(key, value);
    }

    clear() {
        return this.cache.clear();
    }
}

module.exports = {
    MapCache
};