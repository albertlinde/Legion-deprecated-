if (typeof exports != "undefined") {
    CRDT_Database = true;
    exports.CRDT = CRDT;
}


//TODO: the crdt_type thing is not used. should be defined else-where.
//TODO: not all crdts have merge, compare, etc...
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
        },
        garbageCollect: function (gcvv) {
        },
        getDelta: function (fromVV) {
        },
        applyDelta: function (statePart, vv, gcvv) {
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
    //TODO: {ObjectStore | CRDT_Database} -> there should be well defined interfaces.
    this.objectStore = objectStore;
    this.objectID = objectID;
    //TODO: a crdt with a crdt which has a crdt?
    //TODO: well defined CRDT types.
    // the following things are only valid for some cases.
    // maybe even separate to different sub crtd objects?
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

    this.garbageCollect = crdt.crdt.garbageCollect;
    this.getDelta = crdt.crdt.getDelta;
    this.applyDelta = crdt.crdt.applyDelta;

    /**
     * State of garbace collection.
     * @type {{number: number}}
     */
    this.gcvv = {};

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
                        c.objectStore.propagate(c.objectID, "ObjectServer", c.localOP, {all: true}, c.crdt.type);
                        if (c.callback)
                            c.callback(cbVal, {local: true});
                    } else {
                        //Client operation.
                        var cbVal = c.remotes[key].apply(c, [l_ret]);
                        c.addOpToHistory(c.objectStore.legion.id, ++c.localOP, l_ret, key, beforeVV);
                        c.addOpToCurrentVersionVector(c.objectStore.legion.id, c.localOP);
                        c.objectStore.propagate(c.objectID, c.objectStore.legion.id, c.localOP, {all: true}, c.crdt.type);
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
                    if (ret.change) {
                        c.objectStore.propagateState(c.objectID, {all: true});
                        if (c.callback)
                            c.callback(ret, {local: true});
                    } else return ret;
                };
            })(keys[i]);
        }
    } else if (this.crdt.propagation == CRDT.DELTA_BASED) {
        for (var i = 0; i < keys.length; i++) {
            (function (key) {
                c[key] = function () {
                    var newOP = {id: c.objectStore.legion.id, o: ++c.localOP};
                    var args = [];
                    for (var arg_i = 0; arg_i < arguments.length; arg_i++) {
                        args.push(arguments[arg_i]);
                    }
                    args.push(newOP);
                    var ret = c.crdt.crdt.operations[key].apply(c, args);
                    c.addOpToCurrentVersionVector(newOP.id, newOP.o);
                    c.objectStore.propagateDelta(c.objectID, {all: true});
                    if (c.callback)
                        c.callback(ret, {local: true});
                };
            })(keys[i]);
        }
    } else {
        console.error("No def for propagation type", this.crdt.propagation);
        console.error(JSON.stringify(this.crdt), objectID);
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
 * Operation based CRDT propagation.
 * @constant
 * @type {number}
 */
CRDT.OP_BASED = 2;

/**
 * Delta based CRDT propagation.
 * @constant
 * @type {number}
 */
CRDT.DELTA_BASED = 3;

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

CRDT.prototype.getGCVV = function () {
    return this.gcvv;
};

/**
 *
 * @param state {Object}
 * @param connection {PeerConnection | ServerConnection}
 * @param originalMessage .{Object}
 */
CRDT.prototype.stateFromNetwork = function (state, connection, originalMessage) {
    var c = this.compare(this.getState(), state);
    console.log("From network: " + c);
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
                this.objectStore.propagateMessage(originalMessage, {type: "STATE", objectID: this.objectID});
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
 * @param deltaVV
 * @param connection
 * @param originalMessage
 */
CRDT.prototype.deltaFromNetwork = function (deltaVV, connection, originalMessage) {
    if (objectsDebug)console.error("deltaFromNetwork");

    var vv = deltaVV.vv;
    var vv_keys = Object.keys(vv);

    var delta_ops = this.getDelta(vv, deltaVV.gcvv);
    if (delta_ops.has) {
        if (objectsDebug)console.info(delta_ops);
        this.objectStore.sendDeltaOPSTo(connection, delta_ops, this);
    }
    for (var i = 0; i < vv_keys.length; i++) {
        if (this.versionVector.contains(vv_keys[i])) {
            if (this.versionVector.get(vv_keys[i]) < vv[vv_keys[i]]) {
                if (objectsDebug)console.info("pd");
                this.objectStore.propagateDelta(this.objectID, {all: true});
                break;
            }
        } else {
            if (objectsDebug)console.info("pd");
            this.objectStore.propagateDelta(this.objectID, {all: true});
            break;
        }
    }
};

/**
 *
 * @param deltaOps
 * @param connection
 * @param originalMessage
 */
CRDT.prototype.deltaOPSFromNetwork = function (deltaOps, connection, originalMessage) {
    if (objectsDebug)console.error("deltaOPSFromNetwork");
    if (objectsDebug)console.error(deltaOps);
    if (objectsDebug)console.error(connection);
    if (objectsDebug)console.error(originalMessage);
    this.applyDelta(deltaOps.delta_ops, deltaOps.vv, deltaOps.gcvv);
    this.garbageCollect(deltaOps.gcvv);

    var vv_keys = Object.keys(deltaOps.vv);
    for (var i = 0; i < vv_keys.length; i++) {
        var key = vv_keys[i];
        if (this.versionVector.contains(key))
            this.versionVector.set(key, Math.max(deltaOps.vv[key], this.versionVector.get(key)));
        else
            this.versionVector.set(key, deltaOps.vv[key]);
    }

};

/**
 *
 * @param operations {Array.<{clientID,dependencyVV,opID,opName,result}>}
 * @param connection {PeerConnection | ObjectServerConnection | GDriveRTObjectsServerConnection}
 * @param originalMessage {Object}
 */
CRDT.prototype.operationsFromNetwork = function (operations, connection, originalMessage) {
    var callbackValues = [];
    var didntHave = [];
    var alreadyHad = [];
    var i = 0;
    var startingLength = operations.length;
    while (operations.length > 0) {
        var did = false;
        //console.log("Operations to go:" + operations.length);
        while (i < operations.length) {
            var op = operations[i];

            if (op.dependencyVV) {
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
            } else i++;
        }
        if (!did) {
            this.objectStore.sendVVToNode(this.objectID, connection.remoteID);
            break;
        }
        i = 0;
    }
    if (alreadyHad.length > 0) {
        //console.warn("Already had:", alreadyHad);
    }
    if (callbackValues.length > 0) {
        if (this.callback) {
            for (var k = 0; k < callbackValues.length; k++) {
                this.callback(callbackValues[k], {local: false});
            }
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
 * @param o {number}
 * @returns {boolean}
 */
CRDT.prototype.alreadyHadOperation = function (clt, o) {
    if (this.versionVector.contains(clt)) {
        return o <= this.versionVector.get(clt);
    } else {
        return false;
    }
};

/**
 *
 * Returns the operations missing at each in form: {vv1:{missing:[]}, vv2:{missing:[]}}.
 * @param vv1
 * @param vv2
 * @returns {{vv1: {missing: {}}, vv2: {missing: {}}}}
 */
CRDT.prototype.versionVectorDiff = function (vv1, vv2) {
    var ret = {vv1: {missing: {}}, vv2: {missing: {}}};
    var keys1 = Object.keys(vv1);
    var keys2 = Object.keys(vv2);
    for (var i = 0; i < keys1.length; i++) {
        var currentKey = keys1[i];
        if (!vv2[currentKey]) {
            ret.vv2.missing[currentKey] = [];
            for (var op_i = 1; op_i <= vv1[currentKey]; op_i++) {
                ret.vv2.missing[currentKey].push(op_i);
            }
        } else if (vv2[currentKey] > vv1[currentKey]) {
            ret.vv1.missing[currentKey] = [];
            for (var op_i = vv1[currentKey] + 1; op_i <= vv2[currentKey]; op_i++) {
                ret.vv1.missing[currentKey].push(op_i);
            }
        }
    }

    for (var j = 0; j < keys2.length; j++) {
        var currentKey = keys2[j];
        if (!vv1[currentKey]) {
            ret.vv1.missing[currentKey] = [];
            for (var op_i = 1; op_i <= vv2[currentKey]; op_i++) {
                ret.vv1.missing[currentKey].push(op_i);
            }
        } else if (vv1[currentKey] > vv2[currentKey]) {
            ret.vv2.missing[currentKey] = [];
            for (var op_i = vv2[currentKey] + 1; op_i <= vv1[currentKey]; op_i++) {
                ret.vv2.missing[currentKey].push(op_i);
            }
        }
    }

    return ret;
};