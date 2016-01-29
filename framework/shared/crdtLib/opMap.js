if (typeof generateUniqueIdentifier == "undefined") {
    generateUniqueIdentifier = function () {
        return ("" + Math.random()).substr(2, 8);
    }
}

if (typeof exports != "undefined") {
    CRDT = require('./../crdt.js');
    CRDT = CRDT.CRDT;
    ALMap = require('./../ALMap.js');
    ALMap = ALMap.ALMap;
}
var op_orMap = {
    type: "OP_ORMap",
    propagation: CRDT.OP_BASED,
    crdt: {
        base_value: {
            state: {adds: ALMap, removes: ALMap}
        },
        getValue: function () {
            var ret = [];
            var keys = this.state.adds.keys();
            for (var i = 0; i < keys.length; i++) {
                ret.push(keys[i], this.state.adds.get(keys[i]).keys());
            }
            return ret;
        },
        operations: {
            set: {
                local: function (key, value) {
                    var unique = generateUniqueIdentifier();
                    var values = this.state.adds.get(key);
                    if (!values) {
                        return {key: key, value: value, unique: unique, removes: []};
                    }
                    if (values.size() == 1 && values.contains(value)) {
                        return null;
                    }
                    var v_removes = values.values();

                    var removes = [];
                    for (var i = 0; i < v_removes.length; i++) {
                        removes = removes.concat(v_removes[i].keys());
                    }

                    return {key: key, value: value, unique: unique, removes: removes};
                },
                remote: function (data) {
                    if (!data.key)return;

                    var ret = {};
                    var key = data.key;
                    var value = data.value;
                    var unique = data.unique;
                    var removes = new ALMap();
                    removes.setAll(data.removes, true);
                    this.state.removes.setAll(data.removes, true);
                    var values = this.state.adds.get(key);

                    if (this.state.removes.contains(unique)) {
                        //dont add
                    } else {
                        if (!values) {
                            values = new ALMap();
                            this.state.adds.set(key, values);
                        }
                        if (values.size() == 0) {
                            var uniques = new ALMap();
                            uniques.set(unique, true);
                            values.set(value, uniques);
                            ret.add = {key: key, value: value};
                        } else if (values.contains(value)) {
                            if (values.get(value) == unique) {
                                console.error("Duplicate unique.")
                            } else {
                                var uniques = values.get(value);
                                uniques.set(unique, true);
                            }
                        } else {
                            var uniques = values.get(value);
                            if (!uniques) {
                                var uniques = new ALMap();
                                values.set(value, uniques);
                            }
                            uniques.set(unique, true);
                            ret.change = {key: key, value: value};
                        }
                    }

                    ret.removes = [];
                    var value_keys = values.keys();
                    for (var i = 0; i < value_keys.length; i++) {
                        var unique_keys = values.get(value_keys[i]).keys();
                        for (var j = 0; j < unique_keys.length; j++) {
                            if (removes.contains(unique_keys[j])) {
                                values.get(value_keys[i]).delete(unique_keys[j]);
                            }
                        }
                        if (values.get(value_keys[i]).size() == 0) {
                            values.delete(value_keys[i]);
                            ret.removes.push({key: key, value: value_keys[i]});
                        }
                    }
                    if (values.size() == 0) {
                        this.state.adds.delete(key);
                    }
                    if (ret.removes.length == 0)
                        delete ret.removes;

                    if (ret.change || ret.add || ret.removes) {
                        return ret
                    }
                }
            },
            contains: {
                local: function (key) {
                    return null;
                },
                remote: function (data) {
                    return this.state.adds.contains(data);
                }
            },
            get: {
                local: function (key) {
                    return null;
                },
                remote: function (data) {
                    return this.state.adds.get(data).keys()
                }
            },
            delete: {
                local: function (key) {
                    var values = this.state.adds.get(key);
                    if (values) {
                        var v_removes = values.values();
                        var removes = [];
                        for (var i = 0; i < v_removes.length; i++) {
                            removes = removes.concat(v_removes[i].keys());
                        }
                        return {key: key, removes: removes};
                    } else {
                        return null;
                    }
                },
                remote: function (data) {
                    if (!data.key)return;

                    var ret = {};
                    var key = data.key;
                    var removes = new ALMap();
                    removes.setAll(data.removes, true);
                    this.state.removes.setAll(data.removes, true);
                    var values = this.state.adds.get(key);

                    ret.removes = [];
                    var value_keys = values.keys();
                    for (var i = 0; i < value_keys.length; i++) {
                        var unique_keys = values.get(value_keys[i]).keys();
                        for (var j = 0; j < unique_keys.length; j++) {
                            if (removes.contains(unique_keys[j])) {
                                values.get(value_keys[i]).delete(unique_keys[j])
                            }
                        }
                        if (values.get(value_keys[i]).size() == 0) {
                            values.delete(value_keys[i]);
                            ret.removes.push({key: key, value: value_keys[i]});
                        }
                    }
                    if (values.size() == 0) {
                        this.state.adds.delete(key);
                    }
                    if (ret.removes.length == 0)
                        delete ret.removes;

                    if (ret.removes) {
                        return ret
                    }
                }
            }
        }
    }
};

if (typeof exports != "undefined") {
    exports.OP_ORMap = op_orMap;
} else {
    CRDT_LIB.OP_ORMap = op_orMap;
}