if (typeof exports != "undefined")
    exports.ALMap = ALMap;

function ALMap() {
    this.map = {};
}

/**
 *
 * @param key {Object}
 * @param value {Object}
 */
ALMap.prototype.set = function (key, value) {
    this.map[key] = value;
};

/**
 * Sets all given keys with a single value or, if value is an array,
 * each keys with the appropriate (by order in array) value.
 * @param keys {Array.<Object>}
 * @param value {Object, Array.<Object>}
 */
ALMap.prototype.setAll = function (keys, value) {
    if (value instanceof Array) {
        for (var i = 0; i < keys.length; i++) {
            this.set(keys[i], value[i]);
        }
    } else {
        for (var i = 0; i < keys.length; i++) {
            this.set(keys[i], value);
        }
    }
};

/**
 *
 * @param keys {Array.<Object>}
 */
ALMap.prototype.deleteAll = function (keys) {
    for (var i = 0; i < keys.length; i++) {
        this.delete(keys[i]);
    }
};

/**
 *
 * @param key {Object}
 */
ALMap.prototype.delete = function (key) {
    this.map[key]=null;
    delete this.map[key];
};

/**
 *
 * @param key {Object}
 * @returns {Object}
 */
ALMap.prototype.get = function (key) {
    return this.map[key];
};

/**
 *
 * @param key {Object}
 * @returns {boolean}
 */
ALMap.prototype.contains = function (key) {
    return typeof(this.map[key]) != "undefined";
};

/**
 *
 * @returns {Object[]}
 */
ALMap.prototype.keys = function () {
    return Object.keys(this.map);
};

/**
 *
 * @returns {Object[]}
 */
ALMap.prototype.values = function () {
    var ret = [];
    var keys = this.keys();
    for (var i = 0; i < keys.length; i++) {
        ret.push(this.get(keys[i]));
    }
    return ret;
};

/**
 *
 * @returns {number}
 */
ALMap.prototype.size = function () {
    return this.keys().length;
};

ALMap.prototype.clear = function () {
    return this.map = [];
};