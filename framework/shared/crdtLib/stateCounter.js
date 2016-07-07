if (typeof exports != "undefined") {
    CRDT = require('./../crdt.js');
    CRDT = CRDT.CRDT;
    ALMap = require('./../ALMap.js');
    ALMap = ALMap.ALMap;
}

var state_counter = {
    type: "STATE_Counter",
    propagation: CRDT.STATE_BASED,
    crdt: {
        base_value: {
            state: {dec: ALMap, inc: ALMap}
        },
        getValue: function () {
            var value = 0;
            var decKeys = this.state.dec.keys();
            var incKeys = this.state.inc.keys();
            for (var decKey = 0; decKey < decKeys.length; decKey++) {
                value -= this.state.dec.get(decKeys[decKey]);
            }
            for (var incKey = 0; incKey < incKeys.length; incKey++) {
                value += this.state.inc.get(incKeys[incKey]);
            }
            return value;
        },
        operations: {
            increment: function (id, amount) {
                if (!amount) {
                    amount = id;
                    id = this.objectStore.legion.id;
                }
                if (!this.state.inc.contains(id))
                    this.state.inc.set(id, 0);
                this.state.inc.set(id, this.state.inc.get(id) + amount);
                return {val: amount, change:true};
            },
            decrement: function (id, amount) {
                if (!amount) {
                    amount = id;
                    id = this.objectStore.legion.id;
                }
                if (!this.state.dec.contains(id))
                    this.state.dec.set(id, 0);
                this.state.dec.set(id, this.state.dec.get(id) + amount);
                return {val: -amount, change:true};
            }
        },
        merge: function (local, remote) {
            var decKeys = remote.dec.keys();
            var incKeys = remote.inc.keys();
            var amount = 0;

            for (var i = 0; i < decKeys.length; i++) {
                var countLocal = local.dec.get(decKeys[i]);
                if (!countLocal) {
                    local.dec.set(decKeys[i], remote.dec.get(decKeys[i]));
                    amount -= remote.dec.get(decKeys[i]);
                } else {
                    amount += (local.dec.get(decKeys[i]) - remote.dec.get(decKeys[i]));
                    local.dec.set(decKeys[i], Math.max(local.dec.get(decKeys[i]), remote.dec.get(decKeys[i])));
                }
            }

            for (var i = 0; i < incKeys.length; i++) {
                var countLocal = local.inc.get(incKeys[i]);
                if (!countLocal) {
                    local.inc.set(incKeys[i], remote.inc.get(incKeys[i]));
                    amount += remote.inc.get(incKeys[i]);
                } else {
                    amount -= (local.inc.get(incKeys[i]) - remote.inc.get(incKeys[i]));
                    local.inc.set(incKeys[i], Math.max(local.inc.get(incKeys[i]), remote.inc.get(incKeys[i])));
                }
            }
            var ret = {};
            ret.mergeResult = local;
            ret.stateChange = amount;
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

            var v1Inc = local.inc;
            var v2Inc = remote.inc;

            var v1Dec = local.dec;
            var v2Dec = remote.dec;

            if (v1Inc.size() > v2Inc.size() || v1Dec.size() > v2Dec.size()) {
                first = true;
            }

            if (v2Inc.size() > v1Inc.size() || v2Dec.size() > v1Dec.size()) {
                second = true;
            }
            if (first && second) {
                return CRDT.STATE.COMPARE_RESPONSE.MUST_MERGE;
            }

            if (!first) {
                var keysInc1 = v1Inc.keys();
                for (var i = 0; i < keysInc1.length; i++) {
                    var currKey = keysInc1[i];
                    if (!v2Inc.contains(currKey)) {
                        return CRDT.STATE.COMPARE_RESPONSE.MUST_MERGE;
                    } else {
                        if (v1Inc.get(currKey) > v2Inc.get(currKey)) {
                            first = true;
                            break;
                        }
                    }
                }

                var keysDec1 = v1Dec.keys();
                for (var i = 0; i < keysDec1.length; i++) {
                    var currKey = keysDec1[i];
                    if (!v2Dec.contains(currKey)) {
                        return CRDT.STATE.COMPARE_RESPONSE.MUST_MERGE;
                    } else {
                        if (v1Dec.get(currKey) > v2Dec.get(currKey)) {
                            first = true;
                            break;
                        }
                    }
                }
            }
            if (!second) {
                var keysInc2 = v2Inc.keys();
                for (var i = 0; i < keysInc2.length; i++) {
                    var currKey = keysInc2[i];
                    if (!v1Inc.contains(currKey)) {
                        return CRDT.STATE.COMPARE_RESPONSE.MUST_MERGE;
                    } else {
                        if (v2Inc.get(currKey) > v1Inc.get(currKey)) {
                            second = true;
                            break;
                        }
                    }
                }

                var keysDec2 = v2Dec.keys();
                for (var i = 0; i < keysDec2.length; i++) {
                    var currKey = keysDec2[i];
                    if (!v1Dec.contains(currKey)) {
                        return CRDT.STATE.COMPARE_RESPONSE.MUST_MERGE;
                    } else {
                        if (v2Dec.get(currKey) > v1Dec.get(currKey)) {
                            second = true;
                            break;
                        }
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
        },
        fromJSONString: function (jsObject) {
            var ret = {dec: new ALMap(), inc: new ALMap()};

            var dec = jsObject.dec;
            var inc = jsObject.inc;

            for (var i = 0; i < dec.length; i++) {
                ret.dec.set(dec[i][0], dec[i][1]);
            }
            for (var i = 0; i < inc.length; i++) {
                ret.inc.set(inc[i][0], inc[i][1]);
            }
            return ret;
        },
        toJSONString: function (state) {
            var decKeys = state.dec.keys();
            var incKeys = state.inc.keys();

            var dec = [];
            var inc = [];

            for (var i = 0; i < decKeys.length; i++) {
                dec.push([decKeys[i], state.dec.get(decKeys[i])]);
            }
            for (var i = 0; i < incKeys.length; i++) {
                inc.push([incKeys[i], state.inc.get(incKeys[i])]);
            }

            return {dec: dec, inc: inc};
        }
    }
};
if (typeof exports != "undefined") {
    exports.STATE_Counter = state_counter;
} else {
    CRDT_LIB.STATE_Counter = state_counter;
}