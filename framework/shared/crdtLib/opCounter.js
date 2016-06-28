if (typeof exports != "undefined") {
    CRDT = require('./../crdt.js');
    CRDT = CRDT.CRDT;
    ALMap = require('./../ALMap.js');
    ALMap = ALMap.ALMap;
}

var op_counter = {
    type: "OPERATIONS_Counter",
    propagation: CRDT.OP_BASED,
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
            increment: {
                local: function (id, amount) {
                    if (!amount) {
                        amount = id;
                        id = this.objectStore.legion.id;
                    }
                    return {id: id, amount: amount};
                }, remote: function (data) {
                    if (!this.state.inc.contains(data.id))
                        this.state.inc.set(data.id, 0);
                    this.state.inc.set(data.id, this.state.inc.get(data.id) + data.amount);
                    return data.amount;
                }
            },
            decrement: {
                local: function (id, amount) {
                    if (!amount) {
                        amount = id;
                        id = this.objectStore.legion.id;
                    }
                    return {id: id, amount: amount};
                }, remote: function (data) {
                    if (!this.state.dec.contains(data.id))
                        this.state.dec.set(data.id, 0);
                    this.state.dec.set(data.id, this.state.dec.get(data.id) + data.amount);
                    return -data.amount;
                }
            }
        }
    }
};
if (typeof exports != "undefined") {
    exports.OPERATIONS_Counter = op_counter;
} else {
    CRDT_LIB.OPERATIONS_Counter = op_counter;
}