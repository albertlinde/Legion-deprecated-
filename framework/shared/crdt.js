if (typeof exports != "undefined")
    exports.CRDT = CRDT;


/**
 * Notice: this object's only use is type checking.
 * @type {{type: string, propagation: number, crdt: {base_value: Function, getValue: Function, operations: {}, merge: Function, compare: Function, fromJSONString: Function, toJSONString: Function}}}
 */
var crtd_type = {
    type: "crdtType",
    propagation: 0 | 1,
    crdt: {
        /**
         * Returns the starting (empty) internal CRDT state.
         * @type {Object}
         */
        base_value: function () {
        },

        /**
         * Returns the CRDT value (application use-able).
         * @type {Function}
         */
        getValue: function () {
        },

        operations: {},

        /**
         * Receives two arguments, returning the merge of both objects applied on the first argument.
         * @type {Function}
         */
        merge: function (local, remote) {
        },

        compare: function (local, remote) {
        },

        fromJSONString: function (jsObject) {
        },

        toJSONString: function (state) {
        }
    }
};


/**
 * CRDT instance as encapsulation.
 * @param objectID
 * @param crdt {crtd_type}
 * @constructor
 */
function CRDT(objectID, crdt) {
    this.objectID = objectID;
    this.crdt = crdt;


    this.state = {};


    this.getValue = crdt.crdt.getValue;


    this.merge = crdt.crdt.merge;

    /**
     * Accepts two arguments (state).
     * Returns L,E,H if the second argument is, in order, lower, equal or higher then the first argument.
     * Returns MM if no conclusion can be made (i.e., must merge).
     * Returns {CRDT.STATE.COMPARE_RESPONSE.EQUALS|CRDT.STATE.COMPARE_RESPONSE.LOWER|CRDT.STATE.COMPARE_RESPONSE.HIGHER|CRDT.STATE.COMPARE_RESPONSE.MUST_MERGE}
     * @type {Function}
     * @returns {CRDT.STATE.COMPARE_RESPONSE.EQUALS|CRDT.STATE.COMPARE_RESPONSE.LOWER|CRDT.STATE.COMPARE_RESPONSE.HIGHER|CRDT.STATE.COMPARE_RESPONSE.MUST_MERGE}
     *
     */
    this.compare = crdt.crdt.compare;

    /**
     * Accepts a JSON representation (jsObject, i.e., JSON parsed) of a CRDT and returns an Javascript Object.
     * @type {Function}
     */
    this.fromJSONString = crdt.crdt.fromJSONString;

    /**
     * Accepts a Javascript object (CRDT state) and returns a JSON representation.
     * @type {Function}
     */
    this.toJSONString = crdt.crdt.toJSONString;

    /**
     * Creates a default value (empty object).
     */
    var stateKeys = Object.keys(this.crdt.crdt.base_value.state);
    for (var i = 0; i < stateKeys.length; i++) {
        if (typeof this.crdt.crdt.base_value.state[stateKeys[i]] == "function") {
            this.state[stateKeys[i]] = new this.crdt.crdt.base_value.state[stateKeys[i]]();
        } else {
            this.state[stateKeys[i]] = JSON.parse(JSON.stringify(this.crdt.crdt.base_value.state[stateKeys[i]]));
        }
    }

    this.locals = [];
    this.remotes = [];

    /**
     * Assigns local operations.
     */
    var keys = Object.keys(this.crdt.crdt.operations);
    var c = this;
    if (this.crdt.propagation == CRDT.OP_BASED) {
        for (var i = 0; i < keys.length; i++) {
            (function () {
                const key = keys[i];
                c.locals[key] = c.crdt.crdt.operations[key].local;
                c.remotes[key] = c.crdt.crdt.operations[key].remote;
                c[key] = function () {
                    var l_ret = c.locals[key].apply(arguments);
                    //TODO: propagate l_ret;
                    return c.remotes[key](l_ret);
                };
            })();
        }
    } else if (this.crdt.propagation == CRDT.STATE_BASED) {
        for (var i = 0; i < keys.length; i++) {
            this[keys[i]] = this.crdt.crdt.operations[keys[i]];
        }
    } else {
        console.error("I am here: " + JSON.stringify(this.crdt));
    }

    /**
     * Contains a callback for object updates (user defined).
     * @type {Function|null}
     */
    this.callback = null
}

/**
 * State based CRDT propagation.
 * @constant
 * @type {number}
 */
CRDT.STATE_BASED = 1;

/**
 * Operaiton based CRDT propagation.
 * @constant
 * @type {number}
 */
CRDT.OP_BASED = 2;

/**
 * State based CRDT constants.
 * @constant
 * @type {number}
 */
CRDT.STATE = Object.freeze({
    COMPARE_RESPONSE: {
        EQUALS: 1,
        LOWER: 2,
        HIGHER: 3,
        MUST_MERGE: 4
    }
});

/**
 * Return the internal state of the object.
 * @returns {Object}
 */
CRDT.prototype.getState = function () {
    return this.state;
};

/**
 * Called by local operations, the merge function, or the overwrite funciton.
 * Calls callback set by setOnStateChange.
 * @param data
 */
CRDT.prototype.stateChanged = function (data) {
    this.callback(data);
};

/**
 * Sets a callback for updates on CRDT state.
 * @param callback {Function}
 */
CRDT.prototype.setOnStateChange = function (callback) {
    this.callback = callback;
};

CRDT.prototype.getOperations = function (ids) {
    console.error("Not implemented.");
    return {};
};

CRDT.prototype.getVersionVector = function () {
    console.error("Not implemented.");
    //TODO
};

/**
 *
 * @param state {Object}
 * @param connection {PeerConnection | ServerConnection}
 */
CRDT.prototype.stateFromNetwork = function (state, connection) {
    console.error("Not implemented.");
};

/**
 *
 * @param operations {Object}
 * @param connection {PeerConnection | ServerConnection}
 */
CRDT.prototype.operationsFromNetwork = function (operations, connection) {
    console.error("Not implemented.");

};