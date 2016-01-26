if (typeof exports != "undefined") {
    CRDT_Database = true;
    exports.CRDT = CRDT;
}


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

        getValue: function () {
        },

        operations: {},

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
 * @param objectStore {ObjectStore | CRDT_Database}
 * @constructor
 */
function CRDT(objectID, crdt, objectStore) {
    this.objectStore = objectStore;
    this.objectID = objectID;
    this.crdt = crdt;


    this.state = {};

    /**
     * Returns the CRDT value (application use-able).
     * @type {Function}
     */
    this.getValue = crdt.crdt.getValue;

    /**
     * Receives two arguments, returning the merge of both objects applied on the first argument.
     * Returns {mergeResult = local, stateChange = amount}.
     * mergeResult has the merge result.
     * stateChange has the value to be sent to the application.
     * @type {Function}
     */
    this.merge = crdt.crdt.merge;

    /**
     * Receives two arguments (state).
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

    this.localOP = 0;

    /**
     * Each pos (clientID) contain  s an ALMap, which contains at each pos the opID and the l_ret value.
     */
    this.opHistory = new ALMap();

    /**
     * Each pos (clientID) contains the highest op applied.
     * @type {ALMap}
     */
    this.versionVector = new ALMap();
    /**
     * Assigns local operations.
     */
    var keys = Object.keys(this.crdt.crdt.operations);
    var c = this;
    if (this.crdt.propagation == CRDT.OP_BASED) {
        for (var i = 0; i < keys.length; i++) {
            (function (key) {
                c.locals[key] = c.crdt.crdt.operations[key].local;
                c.remotes[key] = c.crdt.crdt.operations[key].remote;
                c[key] = function () {
                    var l_ret = c.locals[key].apply(c, arguments);
                    var beforeVV = c.getVersionVector();
                    if (!l_ret)
                        return c.remotes[key].apply(c, arguments);
                    if (typeof CRDT_Database != "undefined") {
                        //Special case for merge from remote-server.
                        //NOTICE: this piece of code is executed by the server!
                        //TODO: redefine how the server adds its own operations. (merge with redis, etc)
                        var cbVal = c.remotes[key].apply(c, [l_ret]);
                        c.addOpToHistory("ObjectServer", ++c.localOP, l_ret, key, beforeVV);
                        c.addOpToCurrentVersionVector("ObjectServer", c.localOP);
                        c.objectStore.propagate(c.objectID, "ObjectServer", c.localOP, {all: true});
                        if (c.callback)
                            c.callback(cbVal, {local: true});
                    } else {
                        //Client operation.
                        c.addOpToHistory(c.objectStore.legion.id, ++c.localOP, l_ret, key, beforeVV);
                        c.addOpToCurrentVersionVector(c.objectStore.legion.id, c.localOP);
                        c.objectStore.propagate(c.objectID, c.objectStore.legion.id, c.localOP, {all: true});
                        var cbVal = c.remotes[key].apply(c, [l_ret]);
                        if (c.callback)
                            c.callback(cbVal, {local: true});
                        return cbVal;
                    }
                };
            })(keys[i]);
        }
    } else if (this.crdt.propagation == CRDT.STATE_BASED) {
        for (var i = 0; i < keys.length; i++) {
            (function (key) {
                c[key] = function () {
                    var ret = c.crdt.crdt.operations[key].apply(c, arguments);
                    c.objectStore.propagateState(c.objectID, {all: true});
                    if (c.callback)
                        c.callback(ret, {local: true});
                };
            })(keys[i]);
        }
    } else {
        console.error("I am here: " + JSON.stringify(this.crdt));
    }

    /**
     * Contains a callback for object updates (user defined).
     * The first argument of the callback will be CRDT defined.
     * The second argument is a JSObject {local: bool}.
     * The local value is true when change happened due to local operations.
     * False when due to a remote operation.
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

CRDT.prototype.addOpToCurrentVersionVector = function (clientID, operationID) {
    this.versionVector.set(clientID, operationID);
};

CRDT.prototype.addOpToHistory = function (clientID, operationID, local_ret, opName, dependencyVV) {
    var clientMap = this.opHistory.get(clientID);
    if (!clientMap) {
        clientMap = new ALMap();
        this.opHistory.set(clientID, clientMap);
    }
    clientMap.set(operationID, {dependencyVV: dependencyVV, opID: operationID, result: local_ret, opName: opName});
};

CRDT.prototype.getOpFromHistory = function (clientID, operationID) {
    var clientMap = this.opHistory.get(clientID);
    if (!clientMap) {
        return undefined;
    }
    return clientMap.get(operationID);
};

/**
 * Return the internal state of the object.
 * @returns {Object}
 */
CRDT.prototype.getState = function () {
    return this.state;
};

/**
 * Sets a callback for updates on CRDT state.
 * @param callback {Function}
 */
CRDT.prototype.setOnStateChange = function (callback) {
    this.callback = callback;
};

/**
 *
 * @param ids {{}}
 * @returns {[]}
 */
CRDT.prototype.getOperations = function (ids) {
    var ops = [];
    var keys = Object.keys(ids);
    for (var i = 0; i < keys.length; i++) {
        var key_i = keys[i];
        var array_i = ids[key_i];
        for (var j = 0; j < array_i.length; j++) {
            var op_i = array_i[j];
            var thing = this.getOpFromHistory(key_i, op_i);
            thing.clientID = key_i;

            ops.push(thing);
        }
    }
    return ops;
};

/**
 *
 * @returns {{}}
 */
CRDT.prototype.getVersionVector = function () {
    var keys = this.versionVector.keys();
    var vv = {};
    for (var i = 0; i < keys.length; i++) {
        vv[keys[i]] = this.versionVector.get(keys[i]);
    }
    return vv;
};

/**
 *
 * @param state {Object}
 * @param connection {PeerConnection | ServerConnection}
 * @param originalMessage {Object, null}
 */
CRDT.prototype.stateFromNetwork = function (state, connection, originalMessage) {
    var c = this.compare(this.getState(), state);
    switch (c) {
        case CRDT.STATE.COMPARE_RESPONSE.EQUALS:
            //no op
            break;
        case CRDT.STATE.COMPARE_RESPONSE.LOWER:
            //I win.
            this.objectStore.propagateState(this.objectID, {onlyTo: connection});
            break;
        case CRDT.STATE.COMPARE_RESPONSE.HIGHER:
            //He wins
            var args = this.merge(this.getState(), state);
            this.state = args.mergeResult;
            if (this.callback)
                this.callback(args.stateChange, {local: false});
            if (originalMessage) {
                originalMessage.options = {except: connection.remoteID};
                this.objectStore.propagateMessage(originalMessage);
            } else {
                this.objectStore.propagateState(this.objectID, {except: connection});
            }
            break;
        case CRDT.STATE.COMPARE_RESPONSE.MUST_MERGE:
            var args = this.merge(this.getState(), state);
            this.state = args.mergeResult;
            if (this.callback)
                this.callback(args.stateChange, {local: false});
            this.objectStore.propagateState(this.objectID, {all: true});
            break;
    }
};

/**
 *
 * @param operations {Array.<{clientID,dependencyVV,opID,opName,result}>}
 * @param connection {PeerConnection | ServerConnection}
 * @param originalMessage {Object, null}
 */
CRDT.prototype.operationsFromNetwork = function (operations, connection, originalMessage) {
    var callbackValues = [];
    var didntHave = [];
    var alreadyHad = [];
    var i = 0;
    var startingLength = operations.length;
    while (operations.length > 0) {
        var did = false;
        console.log("Operations to go:" + operations.length);
        while (i < operations.length) {
            var op = operations[i];
            if (this.alreadyHadOp(op)) {
                alreadyHad.push(op);
                operations.splice(i, 1);
                did = true;
            } else if (this.depsMatchedFor(op)) {
                var cbv = this.remotes[op.opName].apply(this, [op.result]);
                this.addOpToHistory(op.clientID, op.opID, op.result, op.opName, op.dependencyVV);
                this.addOpToCurrentVersionVector(op.clientID, op.opID);
                callbackValues.push(cbv);
                didntHave.push(op);
                operations.splice(i, 1);
                did = true;
            } else {
                i++;
            }
        }
        if (!did) {
            console.log(this.getState());
            console.log(this.getVersionVector());
            console.log(operations);
            this.objectStore.sendVVToNode(this.objectID, connection.remoteID);
            break;
        }
        i = 0;
    }
    if (alreadyHad.length > 0) {
        console.warn("Already had:", alreadyHad);
    }
    if (callbackValues.length > 0) {
        if (this.callback) {
            this.callback(callbackValues, {local: false});
        }
    }
    if (didntHave.length == startingLength) {
        if (originalMessage) {
            originalMessage.options = {except: connection.remoteID};
            this.objectStore.propagateMessage(originalMessage);
        } else {
            this.objectStore.propagateAll(this.objectID, didntHave, {except: connection});
        }
    } else if (didntHave.length > 0) {
        this.objectStore.propagateAll(this.objectID, didntHave, {except: connection});
    }
};

/**
 *
 * @param op {{clientID,dependencyVV,opID,opName,result}}
 */
CRDT.prototype.depsMatchedFor = function (op) {
    var vv = op.dependencyVV;
    //console.log("deosMatchedFor: " + JSON.stringify(op))
    //console.log("deosMatchedFor: " + JSON.stringify(vv))

    var keys = Object.keys(vv);
    for (var i = 0; i < keys.length; i++) {
        //console.log("deosMatchedFor: " + keys[i] + " - " + vv[keys[i]] + " - " + this.alreadyHadOperation(keys[i], vv[keys[i]]))
        if (!this.alreadyHadOperation(keys[i], vv[keys[i]])) {
            return false;
        }
    }
    return true;
};

/**
 *
 * @param op {{clientID,dependencyVV,opID,opName,result}}
 */
CRDT.prototype.alreadyHadOp = function (op) {
    return this.alreadyHadOperation(op.clientID, op.opID);
};

/**
 *
 * @param clt {String}
 * @param opNum {number}
 * @returns {boolean}
 */
CRDT.prototype.alreadyHadOperation = function (clt, opNum) {
    if (this.versionVector.contains(clt)) {
        return opNum <= this.versionVector.get(clt);
    } else {
        return false;
    }
};