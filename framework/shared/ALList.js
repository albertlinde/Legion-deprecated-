if (typeof exports != "undefined")
    exports.ALList = ALList;

function ALList() {
    this.list = [];
}

ALList.prototype.size = function () {
    return this.list.length;
};

ALList.prototype.asArray = function () {
    return this.list;
};

ALList.prototype.put = function (pos, element) {
    if (pos < 0 || pos >= this.list.length) {
        return null;
    }
    this.list = this.list.slice(0, pos)
        .concat([element])
        .concat(this.list.slice(pos, this.size()));
};

ALList.prototype.remove = function (pos) {
    var ret = this.list[pos];
    if (ret) {
        this.list = this.list.slice(0, pos).concat(this.list.slice(pos + 1, this.size()));
        return ret;
    }
};

ALList.prototype.get = function (pos) {
    if (pos < 0 || pos >= this.list.length) {
        return null;
    }
    return this.list[pos];
};

ALList.prototype.toJSONString = function () {
    return this.list;
};

ALList.prototype.fromJSONString = function (string) {
    if (string)
        this.list = string;
    else
        this.list = [];
};