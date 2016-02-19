var legion;
var messaging;
var objectStore;

var debug = false;
var objectsDebug = false;
var detailedDebug = false;
var bullyLog = true;

console.log("Legion example.");
console.log("Step 1 - Open various tabs.");
console.log("Step 2 - run 'start(X)' at each tab, with X the tab number.");
console.log("'messaging.broadcast('Message', 'SomeText') sends a message to (all) other nodes.");

function start(clientID) {
    if (legion) {
        console.warn("Already started.");
        return;
    }
    if (!clientID) {
        console.warn("No clientID given.");
        return;
    }
    var options = {
        clientID: clientID,
        overlayProtocol: B2BOverlay,
        messagingProtocol: FloodMessaging,
        objectOptions: {
            serverInterval: 4000,
            peerInterval: 200
        },
        bullyProtocol: {
            type: SimpleBully,
            options: {
                bullyMustHaveInterval: 30 * 1000,
                bullySendInterval: 7 * 1000,
                bullyStartTime: 2 * 1000
            }
        },
        signallingConnection: {
            type: ServerConnection,
            server: {ip: "localhost", port: 8002}
        },
        objectServerConnection: {
            type: ObjectServerConnection,
            server: {ip: "localhost", port: 8004}
        }
    };

    legion = new Legion(options);
    legion.join();

    messages();
    objects();
}

function messages() {
    messaging = legion.getMessageAPI();
    messaging.setHandlerFor("Message", function (message) {
        console.info(message);
    });
    /*
     setTimeout(function () {
     messaging.broadcast("Message", "Hello");
     }, 15 * 1000);

     setInterval(function () {
     messaging.broadcast("Message", "Hello.");
     }, 15 * 1000);
     */

}

var newRandomValue = function () {
    return "randVal" + ("" + Math.random()).substr(2, 2);
};

var counter_state;
var op_set;
var op_map;

function objects() {
    objectStore = legion.getObjectStore();

    objectStore.defineCRDT(CRDT_LIB.STATE_Counter);
    objectStore.defineCRDT(CRDT_LIB.OP_ORSet);
    objectStore.defineCRDT(CRDT_LIB.OP_ORMap);

    counter_state = objectStore.get("objectID1", CRDT_LIB.STATE_Counter.type);
    op_set = objectStore.get("objectID2", CRDT_LIB.OP_ORSet.type);
    op_map = objectStore.get("objectID3", CRDT_LIB.OP_ORMap.type);

    counter_state.setOnStateChange(function (updates, meta) {
        console.log("Counter change: " + JSON.stringify(updates) + " " + JSON.stringify(meta) + " value: " + JSON.stringify(counter_state.getValue()));
    });
    op_set.setOnStateChange(function (updates, meta) {
        console.log("Set change: " + JSON.stringify(updates) + " " + JSON.stringify(meta) + " value: " + JSON.stringify(op_set.getValue()));
    });
    op_map.setOnStateChange(function (updates, meta) {
        console.log("Map change: " + JSON.stringify(updates) + " " + JSON.stringify(meta) + " value: " + JSON.stringify(op_map.getValue()));
    });

    /*
     setInterval(function () {
     if (Math.random() > 0.2) {
     add();
     } else {
     remove()
     }
     }, 5 * 1000);
     */
}

function rand_N(amount, timer) {
    if (!legion) {
        console.warn("Use start first.");
        return;
    }
    var i = setInterval(function () {
        if (amount-- <= 0) {
            clearInterval(i);
            return;
        }
        if (Math.random() > 0.2) {
            add();
        } else {
            remove()
        }
    }, timer);
}

function add() {
    if (!legion) {
        console.warn("Use start first.");
        return;
    }
    console.log("Adding.");
    counter_state.increment(legion.id, 1);
    var rand = newRandomValue();
    op_set.add(rand);
    op_map.set(rand, newRandomValue());
}

function remove() {
    if (!legion) {
        console.warn("Use start first.");
        return;
    }
    console.log("Removing.");
    var rem = op_set.getValue()[0];
    if (rem)
        op_set.remove(op_set.getValue()[0]);
    counter_state.decrement(legion.id, 1);

    var mapRem = op_map.getValue()[0];
    if (mapRem) {
        mapRem = mapRem[0];
        op_map.delete(mapRem);
    }
}

function printvalues() {
    console.log(op_set.getValue());
    console.log(counter_state.getValue());
    console.log(op_map.getValue());
}