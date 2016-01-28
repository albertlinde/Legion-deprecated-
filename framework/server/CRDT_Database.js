if (typeof exports != "undefined") {
    exports.CRDT_Database = CRDT_Database;

    ALMap = require('./../shared/ALMap.js');
    ALMap = ALMap.ALMap;
    ALQueue = require('./../shared/ALQueue.js');
    ALQueue = ALQueue.ALQueue;
    util = require('util');
    Compressor = require('./../shared/Compressor.js');

}

function CRDT_Database(messaging, peerSyncs) {
    var cb = this;
    this.peerSendInterval = 2000;
    this.peersQueue = new ALQueue();

    this.messagingAPI = messaging;
    this.peerSyncs = peerSyncs;

    this.crdts = new ALMap();
    this.types = new ALMap();

    this.saveTime = 5000;

    this.messageCount = Math.floor((Math.random() * Number.MAX_VALUE) % (Math.pow(10, 10)));
    this.id = "OS";

    setInterval(function () {
        cb.saveToDisk()
    }, this.saveTime);
    setInterval(function () {
        cb.clearPeersQueue();

    }, this.peerSendInterval);
}


/**
 * TODO: queue must be cleaned up as it can contain duplicate stuff!
 */
CRDT_Database.prototype.clearPeersQueue = function () {
    var os = this;
    if (this.peersQueue.size() > 0) {
        console.log("Messages in queue: " + this.peersQueue.size());
        var pop = this.peersQueue.pop();
        var done = new ALMap();
        while (pop) {
            (function (pop) {
                var options = pop.options;
                if (!pop.sender) {
                    var msg = {};
                    switch (pop.type) {
                        case "OP":
                            var objectID = pop.objectID;
                            var clientID = pop.clientID;
                            var operationID = pop.operationID;
                            var thing = "" + objectID + "" + clientID + "" + operationID;
                            if (done.contains(thing))
                                return;
                            else
                                done.set(thing, true);
                            var crdt = os.crdts.get(objectID);
                            var op = crdt.getOpFromHistory(clientID, operationID);
                            op.clientID = clientID;
                            op.objectID = objectID;
                            msg = op;
                            break;
                        case "OPLIST":
                            break;
                        case "STATE":
                            var objectID = pop.objectID;
                            var thing = "" + objectID;
                            if (done.contains(thing)) {
                                return;
                            } else
                                done.set(thing, true);
                            var crdt = os.crdts.get(objectID);
                            var state = crdt.toJSONString(crdt.getState());
                            msg = {objectID: objectID, state: state};
                            break;
                    }
                    pop.msg = msg;
                    if (options.except)
                        options.except = options.except.remoteID;
                    os.generateMessage(os.handlers.gotContentFromNetwork.type, pop, function (result) {
                        var onlyTo = options.onlyTo;
                        if (onlyTo) {
                            console.log("Sending a", result.type, "to", onlyTo);
                            result.destination = onlyTo;
                            if (os.peerSyncs.contains(onlyTo)) {
                                result.destination = onlyTo;
                                var ps = os.peerSyncs.get(onlyTo);
                                ps.send(result);
                            } else {
                                os.messagingAPI.sendTo(onlyTo, result);
                            }
                        } else if (options.except) {
                            console.log("Sending a", result.type, "except", options.except);
                            os.messagingAPI.broadcastMessage(result, [options.except]);
                        } else {
                            console.log("Sending a", result.type, "to all.");
                            os.messagingAPI.broadcastMessage(result, []);
                        }
                    });
                } else {
                    switch (pop.extra.type) {
                        case "STATE":
                            if (done.contains("" + pop.objectID))
                                return;
                            else
                                done.set("" + pop.objectID, true);
                    }
                    delete pop.extra;
                    //IMPORTANT: this generate is actually useless BUT needed to enforce causality.
                    os.generateMessage("Fake", {fake: "data"}, function (answer) {
                        os.messagingAPI.broadcastMessage(pop, [options.except]);
                    });
                }
            })(pop);

            pop = this.peersQueue.pop();
        }
    }
};

CRDT_Database.prototype.sendVVToNode = function (objectID, receiver) {
    var crdt = this.getCRDT(objectID);
    var request = {
        objectID: objectID,
        vv: crdt.getVersionVector()
    };
    var os = this;
    this.generateMessage(this.handlers.version_vector_propagation.type, request, function (result) {
        result.destination = receiver;
        if (os.peerSyncs.contains(receiver)) {
            var ps = os.peerSyncs.get(receiver);
            ps.send(result);
        } else {
            os.legion.messagingAPI.sendTo(receiver, result);
        }
    });
};


CRDT_Database.prototype.saveToDisk = function () {
    console.log("(not) saving to disk.");
    var keys = this.crdts.keys();
    for (var i = 0; i < keys.length; i++) {
        console.log("    KEY: " + keys[i] + " VALUE: " + JSON.stringify(this.getCRDT(keys[i]).getValue()));
    }
};

/**
 *
 * @param clientID {number}
 * @param operationID {number}
 * @param l_ret {Object}
 * @param dependencyVV {Object}
 */
CRDT_Database.prototype.propagate = function (clientID, operationID, l_ret, dependencyVV) {
    util.error("Not Implemented: propagate");
};

CRDT_Database.prototype.propagateMessage = function (message, extra) {
    message.extra = extra;
    this.peersQueue.push(message);
};

CRDT_Database.prototype.propagateAll = function (objectID, ops, options) {
    var queuedOP = {
        type: "OPLIST",
        ops: ops,
        objectID: objectID,
        options: options
    };
    this.peersQueue.push(queuedOP);
};

CRDT_Database.prototype.propagateState = function (objectID, options) {
    var queuedOP = {
        type: "STATE",
        objectID: objectID,
        options: options
    };
    this.peersQueue.push(queuedOP);
};

CRDT_Database.prototype.defineCRDT = function (crdt) {
    if (this.types.contains(crdt.type)) {
        util.error("Can't redefine existing CRDT.", crdt);
    } else {
        this.types.set(crdt.type, crdt);
        util.log("CRDT defined: " + crdt.type);
    }
};

CRDT_Database.prototype.createCRDT = function (objectID, type) {
    if (!this.types.contains(type)) {
        util.error("No typedef found for CRDT.", type);
    } else {
        var crdt = this.types.get(type);
        var instance = new CRDT(objectID, crdt, this);
        this.crdts.set(objectID, instance);
        return instance;
    }
};


CRDT_Database.prototype.getIdentifiers = function () {
    return this.crdts.keys();
};


CRDT_Database.prototype.gotContentFromNetwork = function (message, original, connection) {
    if (!original.options)
        original.options = {};
    original.options.except = connection;
    switch (message.content.type) {
        case "OP":
            var objectID = message.content.msg.objectID;
            var crdt = this.getCRDT(objectID);
            crdt.operationsFromNetwork([message.content.msg], connection, original);
            break;
        case "OPLIST":
            var ops = message.content.ops;
            var crdt = this.getCRDT(message.content.objectID);
            crdt.operationsFromNetwork(ops, connection, original);
            break;
        case "STATE":
            var objectID = message.content.msg.objectID;
            var crdt = this.getCRDT(objectID);
            crdt.stateFromNetwork(crdt.fromJSONString(message.content.msg.state), connection, original);
            break;
    }
};

CRDT_Database.prototype.gotVVFromNetwork = function (message, original, connection) {
    var objectID = message.content.objectID;
    var hisVV = message.content.vv;

    var crdt = this.getCRDT(objectID);

    var vvDiff = this.versionVectorDiff(crdt.getVersionVector(), hisVV);

    var os = this;
    if (vvDiff.vv2.missing.length > 0) {
        if (objectsDebug) {
            console.log("Peer is missing ops.");
        }
        var operations = crdt.getOperations(vvDiff.vv2.missing);
        var answer = [];
        answer.push({
            objectID: objectID,
            operations: operations
        });
        this.legion.generateMessage(this.handlers.operations_propagation.type, answer, function (result) {
            if (os.peerSyncs.contains(message.sender)) {
                result.destination = message.sender;
                var ps = os.peerSyncs.get(message.sender);
                ps.send(result);
            } else {
                os.legion.messagingAPI.sendTo(message.sender, result);
            }
        });
    }
    if (vvDiff.vv1.missing.length > 0) {
        if (objectsDebug) {
            console.log("I am missing ops.");
        }
        var request = {
            objectID: objectID,
            vv: crdt.getVersionVector()
        };
        this.legion.generateMessage(this.handlers.version_vector_propagation.type, request, function (result) {
            result.destination = message.sender;
            if (os.peerSyncs.contains(message.sender)) {
                result.destination = message.sender;
                var ps = os.peerSyncs.get(message.sender);
                ps.send(result);
            } else {
                os.legion.messagingAPI.sendTo(message.sender, result);
            }
        });
    }
};

CRDT_Database.prototype.generateMessage = function (type, data, callback) {
    if (!type) {
        util.error("No type for message.");
        return;
    }
    var message = {
        type: type,
        sender: this.id,
        ID: ++this.messageCount
    };
    if (!data) {
        callback(message);
    } else {
        Compressor.compress(JSON.stringify(data), function (response) {
            message.content = response;
            callback(message);
        }, function (error) {
            util.error("Compress failed!", error);
            callback(null);
        });
    }
};

CRDT_Database.prototype.getCRDT = function (identifier, type) {
    var crdt = this.crdts.get(identifier);
    if (crdt)
        return crdt;
    else
        return this.createCRDT(identifier, type);
};