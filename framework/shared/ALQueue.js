if (typeof exports != "undefined")
    exports.ALQueue = ALQueue;

function ALQueue() {
    this.queue = [];
}

/**
 *
 * @returns {number}
 */
ALQueue.prototype.size = function () {
    return this.queue.length;
};

/**
 *
 * @param item {Object}
 */
ALQueue.prototype.push = function (item) {
    this.queue.push(item);
};
/**
 *
 * @returns {Object}
 */
ALQueue.prototype.pop = function () {
    var item = this.queue[0];
    this.queue.slice(1);
    return item;
};


ALQueue.prototype.clear = function(){
    this.queue = [];
};