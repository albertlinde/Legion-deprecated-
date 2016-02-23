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

var state_set = {
    type: "STATE_Set",
    propagation: CRDT.STATE_BASED,
    crdt: {
        base_value: {
            state: {adds: ALMap, removes: ALMap}
        },
        getValue: function () {
            return this.state.adds.keys();
        },
        operations: {
            add: function (element) {
                if (!this.state.adds.contains(element)) {
                    this.state.adds.set(element, new ALMap());
                    var e = this.state.adds.get(element);
                    e.set(generateUniqueIdentifier(), true);
                    return {add: element};
                }
            },
            remove: function (element) {
                var e = this.state.adds.get(element);
                if (e) {
                    var data = {element: element, removes: e.keys()};
                    for (var i = 0; i < data.removes.length; i++) {
                        this.state.removes.set(data.removes[i], true);
                        e.delete(data.removes[i]);
                    }
                    if (e.size() == 0) {
                        this.state.adds.delete(data.element);
                        return {remove: data.element};
                    }
                }
            }
        },
        merge: function (local, remote) {
            local.removes.setAll(remote.removes.keys(), true);

            var stateChange = {adds: [], removes: []};

            var keys_r = remote.adds.keys();
            for (var k = 0; k < keys_r.length; k++) {
                var er = remote.adds.get(keys_r[k]);
                var er_keys = er.keys();
                for (var kj = 0; kj < er_keys.length; kj++) {
                    if (local.removes.contains(er_keys[kj])) {
                        //no op.
                    } else {
                        var local_e = local.adds.get(keys_r[k]);
                        if (!local_e) {
                            local_e = new ALMap();
                            local.adds.set(keys_r[k], local_e);
                            stateChange.adds.push(keys_r[k]);
                        }
                        if (!local_e.contains(er_keys[kj])) {
                            local_e.set(er_keys[kj], true);
                        }
                    }
                }
            }

            var keys_l = local.adds.keys();
            for (var i = 0; i < keys_l.length; i++) {
                var e = local.adds.get(keys_l[i]);
                var keys_l_u = e.keys();
                for (var j = 0; j < keys_l_u.length; j++) {
                    if (local.removes.contains(keys_l_u[j])) {
                        e.delete(keys_l_u[j]);
                    }
                }
                if (e.size() == 0) {
                    stateChange.removes.push(keys_l[i]);
                    local.adds.delete(keys_l[i]);
                }
            }

            var ret = {};
            ret.mergeResult = local;
            ret.stateChange = stateChange;
            return ret;
        },

        /**
         *
         * @param local
         * @param remote
         * @returns {number}
         */
        compare: function (local, remote) {
            var first = false;
            var second = false;

            var tombs_l = local.removes.keys();
            var tombs_r = remote.removes.keys();

            if (tombs_l.length > tombs_r.length) {
                first = true;
            } else if (tombs_r.length > tombs_l.length) {
                second = true;
            }

            if (!first) {
                for (var i = 0; i < tombs_l.length; i++) {
                    if (!remote.removes.contains(tombs_l[i])) {
                        first = true;
                        break;
                    }
                }
            }
            if (first && second)return CRDT.STATE.COMPARE_RESPONSE.MUST_MERGE;
            if (!second) {
                for (var i = 0; i < tombs_r.length; i++) {
                    if (!local.removes.contains(tombs_r[i])) {
                        second = true;
                        break;
                    }
                }
            }
            if (first && second)return CRDT.STATE.COMPARE_RESPONSE.MUST_MERGE;


            var keys = local.adds.keys().concat(remote.adds.keys());
            for (var i = 0; i < keys.length && !(second && first); i++) {
                var e_l = local.adds.get(keys[i]);
                var e_r = remote.adds.get(keys[i]);

                if (!e_l) {
                    second = true;
                    continue;
                }
                if (!e_r) {
                    first = true;
                    continue;
                }

                var keys_l_u = e_l.keys();
                var keys_r_u = e_r.keys();

                for (var j = 0; !first && j < keys_l_u.length; j++) {
                    if (!e_r.contains(keys_l_u[j])) {
                        first = true;
                    }
                }
                for (var j = 0; !second && j < keys_r_u.length; j++) {
                    if (!e_l.contains(keys_r_u[j])) {
                        second = true;
                    }
                }
            }

            if (first && !second) {
                return CRDT.STATE.COMPARE_RESPONSE.LOWER;
            }
            if (!first && second) {
                return CRDT.STATE.COMPARE_RESPONSE.HIGHER;
            }
            if (!first && !second) {
                return CRDT.STATE.COMPARE_RESPONSE.EQUALS;
            }
            return CRDT.STATE.COMPARE_RESPONSE.MUST_MERGE;
        }
        ,
        fromJSONString: function (jsObject) {
            var ret = {adds: new ALMap(), removes: new ALMap()};

            var adds = jsObject.adds;
            var removes = jsObject.removes;

            for (var i = 0; i < adds.length; i++) {
                var key = adds[i].key;
                var uniques = adds[i].us;
                var newMap = new ALMap();
                newMap.setAll(uniques, true);
                ret.adds.set(key, newMap);
            }

            ret.removes.setAll(removes, true);
            return ret;
        }
        ,
        toJSONString: function (state) {
            var ret = {adds: [], removes: state.removes.keys()};

            var keys = state.adds.keys();
            for (var i = 0; i < keys.length; i++) {
                ret.adds.push({key: keys[i], us: state.adds.get(keys[i]).keys()})
            }
            return ret;
        }
    }
};

if (typeof exports != "undefined") {
    exports.STATE_Set = state_set;
} else {
    CRDT_LIB.STATE_Set = state_set;
}