var CRDT_LIB = {};

/**
 *
 * @param legion {Legion}
 * @constructor
 */
function ObjectStore(legion) {
    this.legion = legion;

    this.types = new ALMap();
    this.crdts = new ALMap();

    this.objectServer = null;

    this.peerSyncs = new ALMap();

    var os = this;
    this.handlers = {
        peerSync: {
            type: "OS:PS", callback: function (message) {
                //console.info(message);
                var ps = os.peerSyncs.get(message.sender);
                if (!ps) {
                    console.warn("Got OS:PS for unknown peer.");
                } else {
                    ps.handleSync(message);
                }
            }
        },
        peerSyncAnswer: {
            type: "OS:PSA", callback: function (message) {
                //console.info(message);
                var ps = os.peerSyncs.get(message.sender);
                if (!ps) {
                    console.warn("Got OS:PSA for unknown peer.");
                } else {
                    ps.handleSyncAnswer(message);
                }
            }
        },
        gotContentFromNetwork: {
            type: "OS:C", callback: function (message, original, connection) {
                //console.info(message);
                os.gotContentFromNetwork(message, original, connection);
            }
        },
        version_vector_propagation: {
            type: "OS:VVP", callback: function (message, original, connection) {
                //console.info(message);
                os.gotVVFromNetwork(message, original, connection);
            }
        }
    };

    this.serverQueue = new ALQueue();

    this.serverTimer = setInterval(function () {
        os.clearServerQueue();
    }, this.legion.options.objectOptions.serverInterval);

    this.peersQueue = new ALQueue();

    this.peersTimer = setInterval(function () {
        os.clearPeersQueue();
    }, this.legion.options.objectOptions.peerInterval);

    var peers = this.legion.overlay.getPeers();
    if (peers.length > 0) {
        console.warn("Already have peers!", peers.length);
    }
    for (var i = 0; i < peers.length; i++) {
        var p = new PeerSync(this.legion, this, peers[i]);
        this.peerSyncs.set(peers[i].remoteID, p);
        p.sync();
    }


    this.legion.messagingAPI.setHandlerFor(this.handlers.peerSync.type, this.handlers.peerSync.callback);
    this.legion.messagingAPI.setHandlerFor(this.handlers.peerSyncAnswer.type, this.handlers.peerSyncAnswer.callback);
    this.legion.messagingAPI.setHandlerFor(this.handlers.gotContentFromNetwork.type, this.handlers.gotContentFromNetwork.callback);
    //this.legion.messagingAPI.setHandlerFor(this.handlers.operations_propagation.type, this.handlers.operations_propagation.callback);
    this.legion.messagingAPI.setHandlerFor(this.handlers.version_vector_propagation.type, this.handlers.version_vector_propagation.callback);

}

/**
 * VV should ONLY be propagated between two peers.
 * @param message
 * @param original
 */
ObjectStore.prototype.gotVVFromNetwork = function (message, original) {
    var objectID = message.content.objectID;
    var hisVV = message.content.vv;

    var crdt = this.crdts.get(objectID);
    if (!crdt) {
        console.warn("Not implemented: vv for CRDT I do not have.")
    }

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
        this.sendVVToNode(objectID, message.sender);
    }
};

ObjectStore.prototype.sendVVToNode = function (objectID, receiver) {
    var crdt = this.crdts.get(objectID);
    var request = {
        objectID: objectID,
        vv: crdt.getVersionVector()
    };
    var os = this;
    this.legion.generateMessage(this.handlers.version_vector_propagation.type, request, function (result) {
        result.destination = receiver;
        if (os.peerSyncs.contains(receiver) && os.peerSyncs.get(receiver).peerConnection.socket.readyState == 1) {
            var ps = os.peerSyncs.get(receiver);
            ps.send(result);
        } else {
            os.legion.messagingAPI.sendTo(receiver, result);
        }
    });
};


ObjectStore.prototype.onMessageFromServer = function (message, original, connection) {
    // console.log(message)
    switch (message.type) {
        case (this.handlers.peerSync.type):
            this.objectServer.handleSync(message, original, connection);
            return;
        case (this.handlers.peerSyncAnswer.type):
            this.objectServer.handleSyncAnswer(message, original, connection);
            return;
        case (this.handlers.gotContentFromNetwork.type):
            this.handlers.gotContentFromNetwork.callback(message, original, connection);
            return;
        case (this.handlers.version_vector_propagation.type):
            this.handlers.version_vector_propagation.callback(message, original, connection);
            return;
    }
    console.error("No typedef for: " + message);
};

ObjectStore.prototype.gotContentFromNetwork = function (message, original, connection) {
    if (!original.options)
        original.options = {};
    original.options.except = connection;

    switch (message.content.type) {
        case "OP":
            var objectID = message.content.msg.objectID;
            var crdt = this.crdts.get(objectID);
            if (crdt) {
                crdt.operationsFromNetwork([message.content.msg], connection, original);
            } else {
                console.error("Got op for no crdt", message)
            }
            break;
        case "OPLIST":
            var ops = message.content.ops;
            var crdt = this.crdts.get(message.content.objectID);
            crdt.operationsFromNetwork(ops, connection, original);
            break;
        case "STATE":
            var objectID = message.content.msg.objectID;
            var crdt = this.crdts.get(objectID);
            if (crdt) {
                crdt.stateFromNetwork(crdt.fromJSONString(message.content.msg.state), connection, original);
            } else {
                console.error("Got state for no crdt", message)
            }
            break;
    }
};

/**
 *
 * @param message
 */
ObjectStore.prototype.propagateMessage = function (message, extra) {
    message.extra = extra;
    this.serverQueue.push(message);
    this.peersQueue.push(message);
};

ObjectStore.prototype.connectToObjectServer = function () {
    new this.legion.options.objectServerConnection.type(this.legion.options.objectServerConnection.server, this, this.legion);
};

ObjectStore.prototype.clearServerQueue = function () {
    var os = this;

    if (!this.legion.bullyProtocol.amBullied()) {
        if (!this.objectServer) {
            console.log("Don't have a connection to objects server. Will try again soon.");
            this.connectToObjectServer();
            return;
        }
    } else {
        if (this.serverQueue.size() > 0) {
            console.log("Clearing server queue. Am bullied.");
            this.serverQueue.clear();
        }
    }

    if (this.serverQueue.size() > 0) {
        console.log("Messages in queue: " + this.serverQueue.size());
        var pop = this.serverQueue.pop();
        var done = new ALMap();
        while (pop) {
            (function (pop) {
                var options = pop.options;
                if (options.onlyTo && (typeof options.onlyTo != "string"))
                    options.onlyTo = options.onlyTo.remoteID;
                if (options.except && (typeof options.except != "string"))
                    options.except = options.except.remoteID;

                if (options.except && options.except == os.objectServer.peerConnection)return;
                if (options.except && options.except == os.objectServer.peerConnection.remoteID)return;
                if (!pop.sender) {
                    var msg = {};
                    switch (pop.type) {
                        case "OP":
                            var objectID = pop.objectID;
                            var clientID = pop.clientID;
                            var operationID = pop.operationID;
                            var crdt = os.crdts.get(objectID);
                            var op = crdt.getOpFromHistory(clientID, operationID);
                            op.clientID = clientID;
                            op.objectID = objectID;
                            msg = op;
                            var thing = "" + objectID + "" + clientID + "" + operationID;
                            if (done.contains(thing))
                                return;
                            else
                                done.set(thing, true);
                            break;
                        case "OPLIST":
                            break;
                        case "STATE":
                            var objectID = pop.objectID;
                            var thing = "" + objectID;
                            if (done.contains(thing))
                                return;
                            else
                                done.set(thing, true);
                            var crdt = os.crdts.get(objectID);
                            var state = crdt.toJSONString(crdt.getState());
                            msg = {objectID: objectID, state: state};
                            break;
                    }

                    pop.msg = msg;
                    os.legion.generateMessage(os.handlers.gotContentFromNetwork.type, pop, function (result) {
                        os.objectServer.send(result);
                    });
                } else {
                    if (pop.extra) {
                        switch (pop.extra.type) {
                            case "STATE":
                                if (done.contains("" + pop.objectID))
                                    return;
                                else
                                    done.set("" + pop.objectID, true);
                        }
                        delete pop.extra;
                    }
                    //IMPORTANT: this generate is actually useless BUT needed to enforce causality.
                    os.legion.generateMessage("Fake", {fake: "data"}, function (answer) {
                        os.objectServer.send(pop);
                    });
                }
            })(pop);

            pop = this.serverQueue.pop();
        }
    }
};

ObjectStore.prototype.clearPeersQueue = function () {
    var os = this;
    if (this.peersQueue.size() > 0) {
        console.log("Messages in queue: " + this.peersQueue.size());
        var pop = this.peersQueue.pop();
        var done = new ALMap();
        while (pop) {
            (function (pop) {
                var options = pop.options;
                const except = options.except;
                if (options.onlyTo && (typeof options.onlyTo != "string"))
                    options.onlyTo = options.onlyTo.remoteID;
                if (options.except && (typeof options.except != "string"))
                    options.except = options.except.remoteID;
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
                            if (done.contains(thing))
                                return;
                            else
                                done.set(thing, true);
                            var crdt = os.crdts.get(objectID);
                            var state = crdt.toJSONString(crdt.getState());
                            msg = {objectID: objectID, state: state};
                            break;
                    }
                    pop.msg = msg;
                    os.legion.generateMessage(os.handlers.gotContentFromNetwork.type, pop, function (result) {
                        const onlyTo = options.onlyTo;
                        if (onlyTo) {
                            result.destination = onlyTo;
                            if (os.peerSyncs.contains(onlyTo)) {
                                if (os.objectServer && onlyTo == os.objectServer.remoteID)
                                    return;
                                result.destination = onlyTo;
                                var ps = os.peerSyncs.get(onlyTo);
                                ps.send(result);
                                console.log("Sent", result.type, "to", onlyTo);
                            } else {
                                os.legion.messagingAPI.sendTo(onlyTo, result);
                            }
                        } else if (except) {
                            //console.log("Sending a", result.type, "except", except.remoteID);
                            os.legion.messagingAPI.broadcastMessage(result, [except, os.legion.connectionManager.serverConnection]);
                        } else {
                            //console.log("Sending a", result.type, "to all.");
                            os.legion.messagingAPI.broadcastMessage(result, [os.legion.connectionManager.serverConnection]);
                        }
                    });
                } else {
                    if (pop.extra) {
                        switch (pop.extra.type) {
                            case "STATE":
                                if (done.contains("" + pop.objectID))
                                    return;
                                else
                                    done.set("" + pop.objectID, true);
                        }
                        delete pop.extra;
                    }
                    //IMPORTANT: this generate is actually useless BUT needed to enforce causality.
                    os.legion.generateMessage("Fake", {fake: "data"}, function (answer) {
                        os.legion.messagingAPI.broadcastMessage(pop, [os.legion.connectionManager.serverConnection]);
                    });
                }
            })
            (pop);

            pop = this.peersQueue.pop();
        }
    }
}
;

/**
 * Defines a CRDT that can later be instantiated.
 * @param crdt {crtd_type}
 */
ObjectStore.prototype.defineCRDT = function (crdt) {
    if (this.types.contains(crdt.type)) {
        console.error("Can't redefine existing CRDT.", crdt);
    } else {
        this.types.set(crdt.type, crdt);
    }
};

/**
 * Creates or obtains a CRDT.
 * @param objectID
 * @param type
 * @returns {Object}
 */
ObjectStore.prototype.get = function (objectID, type) {
    if (!this.types.contains(type)) {
        console.error("No typedef found for CRDT.", type);
    } else {
        if (this.crdts.contains(objectID)) {
            return this.crdts.get(objectID);
        } else {
            var crdt = this.types.get(type);
            var instance = new CRDT(objectID, crdt, this);
            this.crdts.set(objectID, instance);
            return instance;
        }
    }
};

/**
 *
 * @param clientID {number}
 * @param operationID {number}
 * @param options {Object}
 */
ObjectStore.prototype.propagate = function (objectID, clientID, operationID, options) {
    var queuedOP = {
        type: "OP",
        clientID: clientID,
        objectID: objectID,
        operationID: operationID,
        options: options
    };

    this.serverQueue.push(queuedOP);
    this.peersQueue.push(queuedOP);
};

/**
 *
 * @param objectID
 * @param ops
 * @param options {Object}
 */
ObjectStore.prototype.propagateAll = function (objectID, ops, options) {
    var queuedOP = {
        type: "OPLIST",
        ops: ops,
        objectID: objectID,
        options: options
    };

    this.serverQueue.push(queuedOP);
    this.peersQueue.push(queuedOP);
};

/**
 * Added objects connection.
 * @param serverConnection
 */
ObjectStore.prototype.onServerDisconnect = function (serverConnection) {
    this.objectServer = null;
    this.serverQueue.clear();
};

/**
 * Objects connection dropped.
 * @param serverConnection
 */
ObjectStore.prototype.onServerConnection = function (serverConnection) {
    this.objectServer = new PeerSync(this.legion, this, serverConnection);
    this.objectServer.sync();
};

/**
 * Overlay added a peer.
 * @param peerConnection
 */
ObjectStore.prototype.onClientConnection = function (peerConnection) {
    var p = new PeerSync(this.legion, this, peerConnection);
    this.peerSyncs.set(peerConnection.remoteID, p);
    p.sync();
};

/**
 * A peer dropped the connection.
 * @param peerConnection
 */
ObjectStore.prototype.onClientDisconnect = function (peerConnection) {
    var p = this.peerSyncs.get(peerConnection.remoteID);
    if (p) {
        this.peerSyncs.delete(peerConnection.remoteID);
        p.finalize();
    }
};

/**
 * Notice: duplicate code in ObjectsServer.
 * Returns the operations missing at each in form: {vv1:{missing:[]}, vv2:{missing:[]}}.
 * @param vv1
 * @param vv2
 * @returns {{vv1: {missing: {}}, vv2: {missing: {}}}}
 */
ObjectStore.prototype.versionVectorDiff = function (vv1, vv2) {
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
        var currentKey = keys2[i];
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

/**
 *
 * @param objectID {String}
 * @param options {{onlyTo}|{except}|{all}}
 */
ObjectStore.prototype.propagateState = function (objectID, options) {
    var queuedOP = {
        type: "STATE",
        objectID: objectID,
        options: options
    };
    this.serverQueue.push(queuedOP);
    this.peersQueue.push(queuedOP);
};

ObjectStore.prototype.getCRDT = function (objectID) {
    return this.crdts.get(objectID);
};