/**
 * How peer sync works:
 *
 * SYncMSG: on a connection both peers send the current VV of each object they have.
 *      Also send the IDS of any state based objects.
 *
 * on a SYncMSG: peer checks objects the other peer has.
 *      ops objects: check diff, send missing ops to other peer
 *      state object: send current state
 *
 * on sync complete ():
 *      clear the message queue.
 *
 */


/**
 *
 * @param legion {Legion}
 * @param objectStore {ObjectStore}
 * @param peerConnection {PeerConnection}
 * @constructor
 */
function PeerSync(legion, objectStore, peerConnection) {
    this.legion = legion;
    this.objectStore = objectStore;
    this.peerConnection = peerConnection;

    /**
     * True when syncing is done.
     * @type {boolean}
     */
    this.isSynced = false;

    /**
     * Contains updates to be sent after sync.
     * TODO: this queue must have some parsing to eliminate duplicates and merge state propagation of the same object?
     * @type {ALQueue}
     */
    this.queueAfterSync = new ALQueue();

    /**
     * A map of all objects the other peer maintains.
     * @type {ALMap}
     */
    this.sharedObjects = new ALMap();

    var ps = this;
    this.psTimeout = setTimeout(function () {
        console.error("No PeerSync in time.", ps.legion.id, ps.peerConnection.remoteID);
    }, 5 * 1000);
}

PeerSync.prototype.finalize = function () {
    this.isSynced = false;
    this.peerConnection = null;
    this.queueAfterSync.clear();
    this.queueAfterSync = null;
    this.sharedObjects.clear();
    this.sharedObjects = null;
    clearTimeout(this.psTimeout);
};

/**
 * Clears the queue, sending all messages to the peer.
 */
PeerSync.prototype.clearQueue = function () {
    var pop = this.queueAfterSync.pop();
    while (typeof pop != "undefined") {
        this.peerConnection.send(pop);
        pop = this.queueAfterSync.pop();
    }
};

PeerSync.prototype.handleSyncAnswer = function (message) {
    var states = message.content.states;
    var operations = message.content.missing_ops;

    for (var i = 0; i < states.length; i++) {
        var my_crdt = this.objectStore.crdts.get(states[i].id);
        if (!my_crdt) {
            console.warn("I should not be here.");
        } else {
            my_crdt.stateFromNetwork(my_crdt.fromJSONString(states[i].state), this.peerConnection);
        }
    }
    for (var i = 0; i < operations.length; i++) {
        var my_crdt = this.objectStore.crdts.get(operations[i].id);
        if (!my_crdt) {
            console.warn("I should not be here.");
        } else {
            my_crdt.operationsFromNetwork(operations[i].operations, this.peerConnection);
        }
    }

    this.isSynced = true;
};

PeerSync.prototype.handleSync = function (message) {
    var stateObjects = message.content.stateObjects;
    var operationObjects = message.content.operationObjects;

    var answer = {missing_ops: [], states: []};
    for (var i = 0; i < operationObjects.length; i++) {
        var my_crdt = this.objectStore.crdts.get(operationObjects[i].id);
        if (!my_crdt)continue;
        var my_crdts_vv = my_crdt.getVersionVector();
        var vvDiff = this.objectStore.versionVectorDiff(my_crdt, my_crdts_vv);
        if (vvDiff.vv2.missing.length > 0) {
            answer.missing_ops.push({id: my_crdt.id, operations: my_crdt.getOperations(vvDiff.vv2.missing)});
        }
    }
    for (var i = 0; i < stateObjects.length; i++) {
        var my_crdt = this.objectStore.crdts.get(stateObjects[i].id);
        if (!my_crdt)continue;
        answer.states.push({id: my_crdt.id, state: my_crdt.toJSONString(my_crdt.getState())});
    }

    var ps = this;
    this.legion.generateMessage(this.objectStore.handlers.peerSyncAnswer.type, answer, function (result) {
        result.destination = ps.peerConnection.remoteID;
        ps.peerConnection.send(result);
        ps.clearQueue();
    });
};

PeerSync.prototype.sync = function () {
    var ps = this;
    var messageContent = {stateObjects: [], operationObjects: []};

    var localKeys = this.objectStore.crdts.keys();
    for (var i = 0; i < localKeys.length; i++) {
        var crdt = this.objectStore.crdts.get(localKeys[i]);
        if (crdt.crdt.propagation == CRDT.STATE_BASED) {
            messageContent.stateObjects.push({id: crdt.id});
        } else if (crdt.crdt.propagation == CRDT.OP_BASED) {
            messageContent.operationObjects.push({id: crdt.id, vv: crdt.getVersionVector()});
        } else {
            console.error("Shit happened.")
        }
    }
    this.legion.generateMessage(this.objectStore.handlers.peerSync.type, messageContent, function (result) {
        result.destination = ps.peerConnection.remoteID;
        ps.legion.messagingAPI.broadcastMessage(result);
    });
};

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

    this.peerSyncs = new ALMap();

    var os = this;
    this.handlers = {
        peerSync: {
            type: "OS:PS", callback: function (message) {
                var ps = os.peerSyncs.get(message.sender);
                clearTimeout(ps.psTimeout);
                ps.handleSync(message);
            }
        },
        peerSyncAnswer: {
            type: "OS:PSA", callback: function (message) {
                var ps = os.peerSyncs.get(message.sender);
                ps.handleSyncAnswer(message);
            }
        },
        state_propagation: {
            type: "OS:SP", callback: function () {
                console.error("Not Implemented.");
                //TODO
            }
        },
        operations_propagation: {
            type: "OS:OP", callback: function () {
                console.error("Not Implemented.");
                //TODO
            }
        },
        version_vector_propagation: {
            type: "OS:VVP", callback: function () {
                console.error("Not Implemented.");
                //TODO
            }
        }
    };


    /**
     * TODO: this queue must have some parsing to eliminate duplicates and merge state propagation of the same object?
     * TODO: the timer
     * @type {ALQueue}
     */
    this.serverQueue = new ALQueue();

    /**
     * TODO: this queue must have some parsing to eliminate duplicates and merge state propagation of the same object?
     * TODO: the timer
     * @type {ALQueue}
     */
    this.peersQueue = new ALQueue();


    {
        var peers = this.legion.overlay.getPeers();
        if (peers.length > 0) {
            console.warn("Already have peers!", peers.length);
        }
        for (var i = 0; i < peers.length; i++) {
            var p = new PeerSync(this.legion, this, peers[i]);
            this.peerSyncs.set(p.remoteID, p);
            p.sync();
        }
    }

    this.legion.messagingAPI.setHandlerFor(this.handlers.peerSync.type, this.handlers.peerSync.callback);
    this.legion.messagingAPI.setHandlerFor(this.handlers.state_propagation.type, this.handlers.state_propagation.callback);
    this.legion.messagingAPI.setHandlerFor(this.handlers.operations_propagation.type, this.handlers.operations_propagation.callback);
    this.legion.messagingAPI.setHandlerFor(this.handlers.version_vector_propagation.type, this.handlers.version_vector_propagation.callback);

}

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
 * @returns {*}
 */
ObjectStore.prototype.get = function (objectID, type) {
    if (!this.types.contains(type)) {
        console.error("No typedef found for CRDT.", type);
    } else {
        if (this.crdts.contains(objectID)) {
            return this.crdts.get(objectID);
        } else {
            var crdt = this.types.get(type);
            this.crdts.set(objectID, crdt);
            return new CRDT(objectID, crdt);
        }
    }
};

/**
 * Overlay added signalling connection.
 * @param serverConnection
 */
ObjectStore.prototype.onServerDisconnection = function (serverConnection) {
    console.warn("Not Implemented.");
    //TODO: objectsStore in charge of adding objects to objects server.
};

/**
 * Signalling connection dropped.
 * @param serverConnection
 */
ObjectStore.prototype.onServerConnection = function (serverConnection) {
    console.warn("Not Implemented.");
    //TODO: objectsStore NO LONGER in charge of adding objects to objects server.
};

/**
 * Overlay added a peer.
 * @param peerConnection
 */
ObjectStore.prototype.onClientConnection = function (peerConnection) {
    var p = new PeerSync(this.legion, this, peerConnection);
    this.peerSyncs.set(p.remoteID, p);
    p.sync();
};

/**
 * A peer dropped the connection.
 * @param peerConnection
 */
ObjectStore.prototype.onClientDisconnection = function (peerConnection) {
    var p = this.peerSyncs.get(p.remoteID);
    this.peerSyncs.delete(p.remoteID);
    p.finalize();
};

/**
 * Returns the operations missing at each in form: {vv1:{missing:[]}, vv2:{missing:[]}}.
 * @param vv1
 * @param vv2
 * @returns {{vv1: {missing: Array}, vv2: {missing: Array}}}
 */
ObjectStore.prototype.versionVectorDiff = function (vv1, vv2) {
    console.error("Not Implemented.");
    return {vv1: {missing: []}, vv2: {missing: []}};
};