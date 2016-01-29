if (typeof generateUniqueIdentifier == "undefined") {
    generateUniqueIdentifier = function () {
        return ("" + Math.random()).substr(2,8);
    }
}

if (typeof exports != "undefined") {
    CRDT = require('./../crdt.js');
    CRDT = CRDT.CRDT;
    ALMap = require('./../ALMap.js');
    ALMap = ALMap.ALMap;
}
var op_orset = {
    type: "OP_ORSet",
    propagation: CRDT.OP_BASED,
    crdt: {
        base_value: {
            state: {adds: ALMap, removes: ALMap}
        },
        getValue: function () {
            return this.state.adds.keys();
        },
        operations: {
            add: {
                local: function (element) {
                    var unique = generateUniqueIdentifier();
                    return {element: element, unique: unique};
                },
                remote: function (data) {
                    if (!this.state.removes.contains(data.unique)) {
                        if (!this.state.adds.contains(data.element)) {
                            this.state.adds.set(data.element, new ALMap());
                        }
                        var e = this.state.adds.get(data.element);
                        if (!e.contains(data.unique)) {
                            e.set(data.unique, true);
                            return {add: data.element};
                        }
                    }
                }
            },
            remove: {
                local: function (element) {
                    var e = this.state.adds.get(element);
                    if (!e) {
                        return {element: element, removes: []};
                    }
                    var removes = e.keys();
                    return {element: element, removes: removes};
                },
                remote: function (data) {
                    if (data.removes.length == 0) {
                        return {}
                    }
                    var e = this.state.adds.get(data.element);
                    for (var i = 0; i < data.removes.length; i++) {
                        this.state.removes.set(data.removes[i], true);
                        if (e)
                            e.delete(data.removes[i]);
                    }
                    if (e && e.size() == 0) {
                        this.state.adds.delete(data.element);
                        return {remove: data.element};
                    }
                }
            }
        }
    }
};

if (typeof exports != "undefined") {
    exports.OP_ORSet = op_orset;
} else {
    CRDT_LIB.OP_ORSet = op_orset;
}