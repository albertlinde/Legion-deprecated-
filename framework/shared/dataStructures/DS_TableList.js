if (typeof exports != "undefined")
    exports.DS_TableList = DS_TableList;

function DS_TableList() {
    this.list = [];
}

DS_TableList.prototype.size = function () {
    return this.list.length;
};

DS_TableList.prototype.asArray = function () {
    return this.list;
};

DS_TableList.prototype.put = function (pos, element) {
    this.list = this.list.slice(0, pos)
        .concat(element)
        .concat(this.list.slice(pos, this.size()));
};

DS_TableList.prototype.remove = function (pos) {
    var ret = this.list[pos];
    if (ret) {
        this.list = this.list.slice(0, pos).concat(this.list.slice(pos + 1, this.size()));
        return ret;
    }
};

DS_TableList.prototype.get = function (pos) {
    if (pos >= 0 && pos < this.list.length) {
        return this.list[pos];
    }
};
