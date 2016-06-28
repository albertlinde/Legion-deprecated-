if (typeof exports != "undefined") {
    CRDT = require('./../crdt.js');
    CRDT = CRDT.CRDT;
    ALMap = require('./../ALMap.js');
    ALMap = ALMap.ALMap;
}

var delta_counter = {
    type: "DELTA_Counter",
    propagation: CRDT.DELTA_BASED,
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
                return amount;
            },
            decrement: function (id, amount) {
                if (!amount) {
                    amount = id;
                    id = this.objectStore.legion.id;
                }
                if (!this.state.dec.contains(id))
                    this.state.dec.set(id, 0);
                this.state.dec.set(id, this.state.dec.get(id) + amount);
                return -amount;

            }
        },
        garbageCollect: function (gcvv) {
            //There is no GC in this counter.
            return;
        },
        getDelta: function (fromVV, gcvv) {
            var ret = {has: false, incs: [], decs: []};

            var his_vv_keys = Object.keys(fromVV);
            for (var i = 0; i < his_vv_keys.length; i++) {
                if (before({id: his_vv_keys[i], o: fromVV[his_vv_keys[i]]}, this.versionVector)) {
                    ret.has = true;
                    ret.incs.push({id: his_vv_keys[i], value: this.state.inc.get(his_vv_keys[i])});
                    ret.decs.push({id: his_vv_keys[i], value: this.state.dec.get(his_vv_keys[i])});
                }
            }
            //TODO: new on my own VV that he doenst have.
            return ret;
        },
        applyDelta: function (statePart, vv, gcvv) {

            var incs = statePart.incs;
            var decs = statePart.decs;


            if (objectsDebug)console.log("applyDelta");
            if (objectsDebug)console.log(statePart);
            if (objectsDebug)console.log(vv);
            if (objectsDebug)console.log(gcvv);

            for (var inc_i = 0; inc_i < incs.length; inc_i++) {
                var o = incs[inc_i];
                this.state.incs.set(o.id, Math.max(this.state.incs.get(o.id), o.value));
            }
            for (var dec_i = 0; dec_i < decs.length; dec_i++) {
                var o = decs[dec_i];
                this.state.decs.set(o.id, Math.max(this.state.decs.get(o.id), o.value));
            }
        }
    }
};

if (typeof exports != "undefined") {
    exports.DELTA_Counter = delta_counter;
} else {
    CRDT_LIB.DELTA_Counter = delta_counter;
}

var before = function (key, vv) {
    if (vv instanceof ALMap) {
        if (vv.contains(key.id)) {
            return vv.get(key.id) > key.o;
        }
        return false;
    } else {
        if (vv[key.id]) {
            return vv[key.id] > key.o;
        }
        return false;
    }
};

/**
 *
 * @param key
 * @param vv {Object}
 * @returns {boolean}
 */
var after = function (key, vv) {

    if (vv instanceof ALMap) {
        if (vv.contains(key.id)) {
            return vv.get(key.id) < key.o;
        }
        return true;
    } else {
        if (vv[key.id]) {
            return vv[key.id] < key.o;
        }
        return true;
    }
};