if (typeof exports != "undefined")
    exports.ALMap = ALMap;

function ALMap() {
    this.map = [];
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
 *
 * @param key {Object}
 */
ALMap.prototype.delete = function (key) {
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
    return Object.keys(this.map).length;
};