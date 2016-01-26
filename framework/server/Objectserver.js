var PORT = 8004;

var D = require('./../shared/Duplicates.js');
var AL = require('./../shared/ALMap.js');

var CRDT = require('./../shared/crdt.js').CRDT;

var CRDT_LIB = {};
CRDT_LIB.STATE_Counter = require('./../shared/crdtLib/stateCounter.js').STATE_Counter;
CRDT_LIB.OP_ORSet = require('./../shared/crdtLib/opSet.js').OP_ORSet;

var util = require('util');
var WebSocket = require('ws');
var storage = require('node-persist');

var WebSocketServer;
var wss;

function CRDT_Database() {
    this.crdts = new AL.ALMap();
    this.types = new AL.ALMap();
}


/**
 *
 * @param clientID {number}
 * @param operationID {number}
 * @param l_ret {Object}
 * @param dependencyVV {Object}
 */
CRDT_Database.prototype.propagate = function (clientID, operationID, l_ret, dependencyVV) {
    console.warn("Not Implemented: propagate");

};


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
        var instance = new CRDT(objectID, crdt, this);
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


//used by random data to follow.
var newRandomID = function () {
    return "randomServerID" + ("" + Math.random()).substr(2, 1);
};
//used by random data to follow.
var newRandomValue = function () {
    return "randVal" + ("" + Math.random()).substr(2, 2);
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
    util.log(JSON.stringify(CRDT_LIB));
    util.log(JSON.stringify(CRDT_LIB.STATE_Counter));
    db.defineCRDT(CRDT_LIB.STATE_Counter);
    db.defineCRDT(CRDT_LIB.OP_ORSet);

    { //FAKE DATA: INIT (will be called when clients send an object.
        var crdt1 = db.createCRDT("randomCounter1", CRDT_LIB.STATE_Counter.type);
        var crdt2 = db.createCRDT("randomCounter2", CRDT_LIB.STATE_Counter.type);

        var crdt3 = db.createCRDT("randomSet1", CRDT_LIB.OP_ORSet.type);
        var crdt4 = db.createCRDT("randomSet2", CRDT_LIB.OP_ORSet.type);

        //called when updates arrive by clients
        crdt1.setOnStateChange(function (data) {
            console.log("CRDT 1 update:" + data);
        });
        crdt2.setOnStateChange(function (data) {
            console.log("CRDT 2 update:" + data);
        });
        crdt3.setOnStateChange(function (data) {
            console.log("CRDT 3 update:" + JSON.stringify(data));
        });
        crdt4.setOnStateChange(function (data) {
            console.log("CRDT 4 update:" + JSON.stringify(data));
        });
    }

    { //FAKE DATA: clients will execute something along the lines of:
        var counter1 = db.getCRDT("randomCounter1");
        var counter2 = db.getCRDT("randomCounter2");

        var int = setInterval(function () {
            if (Math.random() > 0.3) {
                console.log("Incrementing.");
                var id = newRandomID();
                counter1.increment(id, 1);
                var id = newRandomID();
                counter2.increment(id, 1);
            } else {
                console.log("Decrementing.");
                var id = newRandomID();
                counter1.decrement(id, 1);
                var id = newRandomID();
                counter2.decrement(id, 1);
            }
            console.log("Counter 1: " + counter1.getValue());
            console.log("Counter 1: " + JSON.stringify(counter1.toJSONString(counter1.getState())));
            console.log("Counter 2: " + counter2.getValue());
            console.log("Counter 2: " + JSON.stringify(counter2.toJSONString(counter2.getState())));
            console.log();
        }, 500);

        var set1 = db.getCRDT("randomSet1");
        var set2 = db.getCRDT("randomSet2");

        var intervalSet = setInterval(function () {
            if (Math.random() > 0.2) {
                console.log("Adding.");
                var rand = newRandomValue();
                set1.add(rand);
                var rand = newRandomValue();
                set2.add(rand);
            } else {
                var k1 = set1.getState().adds.keys()[0];
                var k2 = set2.getState().adds.keys()[0];
                console.log("Removing:" + k1 + "-" + k2);
                if (k1)
                    set1.remove(k1);
                if (k2)
                    set2.remove(k2);
            }
            console.log("Set 1: " + set1.getValue());
            console.log("Set 2: " + set2.getValue());

            console.log("Following is metadata");
            console.log("Set 1: " + JSON.stringify(set1.getState().adds.keys()));
            console.log("Set 1: " + JSON.stringify(set1.getState().removes.keys()));
            console.log("Set 2: " + JSON.stringify(set2.getState().adds.keys()));
            console.log("Set 2: " + JSON.stringify(set2.getState().removes.keys()));
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
                    } else {
                        console.log("Duplicate: (" + message.sender + "," + message.ID);
                    }
                });
                socket.on('disconnect', function () {
                    util.log("Disconnected.");
                });
            }
        )
    }
}

