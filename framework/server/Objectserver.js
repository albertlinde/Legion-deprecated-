var PORT = 8004;

var D = require('./../shared/Duplicates.js');
var AL = require('./../shared/ALMap.js');

var util = require('util');
var WebSocket = require('ws');
var storage = require('node-persist');

var WebSocketServer;
var wss;

function CRDT_Database() {
    this.crdts = new AL.ALMap();
    this.types = new AL.ALMap();
}

CRDT_Database.prototype.defineCRDT = function (crdt) {
    if (this.types.contains(crdt.type)) {
        console.error("Can't redefine existing CRDT.", crdt);
    } else {
        this.types.set(crdt.type, crdt);
        console.log("CRDT defined: " + crdt.type);
    }
};

CRDT_Database.prototype.createCRDT = function (objectID, type) {
    if (!this.types.contains(type)) {
        console.error("No typedef found for CRDT.", type);
    } else {
        var crdt = this.types.get(type);
        var instance = new CRDT(objectID, crdt);
        this.crdts.set(objectID, instance);
        return instance;
    }
};

CRDT_Database.prototype.getIdentifiers = function () {
    return this.crdts.keys();
};


CRDT_Database.prototype.getCRDT = function (identifier) {
    return this.crdts.get(identifier);
};

function CRDT(objectID, crdt) {
    console.log("New CRDT: " + objectID);
    this.objectID = objectID;
    this.crdt = crdt;

    this.state = {};
    this.getValue = crdt.crdt.getValue;
    this.merge = crdt.crdt.merge;
    this.compare = crdt.crdt.compare;
    this.fromJSONString = crdt.crdt.fromJSONString;
    this.toJSONString = crdt.crdt.toJSONString;

    var stateKeys = Object.keys(this.crdt.crdt.base_value.state);
    for (var i = 0; i < stateKeys.length; i++) {
        this.state[stateKeys[i]] = JSON.parse(JSON.stringify(this.crdt.crdt.base_value.state[stateKeys[i]]));
    }

    var keys = Object.keys(this.crdt.crdt.operations);
    for (var i = 0; i < keys.length; i++) {
        this[keys[i]] = this.crdt.crdt.operations[keys[i]];
    }

    this.callback = null
}
CRDT.STATE_BASED = 1;
CRDT.OP_BASED = 2;

/**
 * Return the state object.
 * @returns {Object}
 */
CRDT.prototype.getState = function () {
    return this.state;
};

/**
 * Called by local operations or the merge function. Calls callback set by setOnStateChange.
 * @param data
 */
CRDT.prototype.stateChanged = function (data) {
    this.callback(data);
};

/**
 *  Sets a callback for updates on CRDT state.
 * @param callback {Function}
 */
CRDT.prototype.setOnStateChange = function (callback) {
    this.callback = callback;
};

//used by random data to follow.
var newRandomID = function () {
    return "randomServerID" + ("" + Math.random()).substr(2, 1);
};

/**
 * Specification for Counter CRDT.
 */
var state_counter = {
    type: "STATE_Counter",
    propagation: CRDT.STATE_BASED,
    crdt: {
        base_value: {
            state: {dec: [], inc: []}
        },
        getValue: function () {
            var value = 0;
            var decKeys = Object.keys(this.state.dec);
            var incKeys = Object.keys(this.state.inc);
            for (var decKey = 0; decKey < decKeys.length; decKey++) {
                value -= this.state.dec[decKeys[decKey]];
            }
            for (var incKey = 0; incKey < incKeys.length; incKey++) {
                value += this.state.inc[incKeys[incKey]];
            }
            return value;
        },
        operations: {
            increment: function () {
                var id = newRandomID();
                if (!this.state.inc[id])
                    this.state.inc[id] = 0;
                this.state.inc[id] += 1;
                this.stateChanged(1);
            },
            decrement: function () {
                var id = newRandomID();
                if (!this.state.dec[id])
                    this.state.dec[id] = 0;
                this.state.dec[id] += 1;
                this.stateChanged(-1);
            }
        },
        merge: function (local, remote) {
            console.error("Not Implemented.");
        },
        compare: function (local, remote) {
            console.error("Not Implemented.");
        },
        fromJSONString: function (string) {
            console.error("Not Implemented.");
        },
        toJSONString: function (state) {
            var decKeys = Object.keys(state.dec);
            var incKeys = Object.keys(state.inc);

            var dec = [];
            var inc = [];

            for (var i = 0; i < decKeys.length; i++) {
                dec.push([decKeys[i], state.dec[decKeys[i]]]);
            }
            for (var i = 0; i < incKeys.length; i++) {
                inc.push([incKeys[i], state.inc[incKeys[i]]]);
            }

            return {dec: dec, inc: inc};
        }
    }
};


initService();
function initService() {
    WebSocketServer = WebSocket.Server;
    wss = new WebSocketServer({
        port: PORT, verifyClient: function (info, cb) {
            cb(true);
        }
    });

    /**
     * CRDT Database - contains all known crdts.
     * @type {CRDT_Database}
     */
    var db = new CRDT_Database();
    db.defineCRDT(state_counter);

    { //FAKE DATA: INIT (will be called when clients send an object.
        var crdt1 = db.createCRDT("randomCounter1", "STATE_Counter");
        var crdt2 = db.createCRDT("randomCounter2", "STATE_Counter");

        //called when updates arrive by clients
        crdt1.setOnStateChange(function (data) {
            console.log("CRDT 1 update:" + data);
        });
        crdt2.setOnStateChange(function (data) {
            console.log("CRDT 2 update:" + data);
        });
    }

    { //FAKE DATA: clients will execute something along the lines of:
        var counter1 = db.getCRDT("randomCounter1");
        var counter2 = db.getCRDT("randomCounter2");

        var int = setInterval(function () {
            if (Math.random() > 0.3) {
                console.log("Incrementing.");
                counter1.increment();
                counter2.increment();
            } else {
                console.log("Decrementing.");
                counter1.decrement();
                counter2.decrement();
            }
            console.log("Counter 1: " + counter1.getValue());
            console.log("Counter 1: " + JSON.stringify(counter1.toJSONString(counter1.getState())));
            console.log("Counter 2: " + counter2.getValue());
            console.log("Counter 2: " + JSON.stringify(counter2.toJSONString(counter2.getState())));
            console.log();
        }, 500);
    }

    { // Client connection handling.
        var duplicates = new D.Duplicates();
        var nodes = [];

        wss.on('connection', function (socket) {
                util.log("Connection.");
                nodes.push(socket);
                socket.on('message', function incoming(message) {
                    util.log(message);
                    if (!duplicates.contains(message.sender, message.ID)) {
                        duplicates.add(message.sender, message.ID);
                        var parsed = JSON.parse(message);
                        var l = nodes.length;
                        for (var i = 0; i < l; i++) {
                            if (nodes[i] === socket)continue;
                            if (nodes[i].readyState == 1) {
                                util.log("Sending.");
                                nodes[i].send(message);
                            } else {
                                nodes.splice(i, 1);
                                i--;
                                l = nodes.length;
                                util.log("Node disconnected.");
                            }
                        }
                    }
                });
                socket.on('disconnect', function () {
                    util.log("Disconnected.");
                });
            }
        )
    }
}

