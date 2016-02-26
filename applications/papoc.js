var legion;
var objectStore;

var debug = false;
var objectsDebug = false;
var detailedDebug = false;
var bullyLog = false;

console.log("Step 1 - Open various tabs.");
console.log("Step 2 - run 'start(X)' at each tab, with X the tab number.");

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
            serverInterval: 1000000,
            peerInterval: 5000
        },
        bullyProtocol: {
            type: SimpleBully,
            options: {
                bullyMustHaveInterval: 60 * 1000,
                bullySendInterval: 15 * 1000,
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

    objects();
}

var newRandomValue = function () {
    return legion.id + "randVal" + legion.id + ("" + Math.random()).substr(2, 5);
};

var op_set;
var state_set;
var delta_set;

function objects() {
    objectStore = legion.getObjectStore();

    objectStore.defineCRDT(CRDT_LIB.OP_ORSet);
    objectStore.defineCRDT(CRDT_LIB.STATE_Set);
    objectStore.defineCRDT(CRDT_LIB.DELTA_Set);


    op_set = objectStore.get("objectID2", CRDT_LIB.OP_ORSet.type);
    state_set = objectStore.get("objectID4", CRDT_LIB.STATE_Set.type);
    delta_set = objectStore.get("objectID5", CRDT_LIB.DELTA_Set.type);
    /**
     state_set.setOnStateChange(function (updates, meta) {
        console.log("State Set change: " + JSON.stringify(updates) + " " + JSON.stringify(meta) + " value: " + JSON.stringify(state_set.getValue()));
    });
     delta_set.setOnStateChange(function (updates, meta) {
        console.log("Delta Set change: " + JSON.stringify(updates) + " " + JSON.stringify(meta) + " value: " + JSON.stringify(delta_set.getValue()));
    });
     op_set.setOnStateChange(function (updates, meta) {
        console.log("OP Set change: " + JSON.stringify(updates) + " " + JSON.stringify(meta) + " value: " + JSON.stringify(op_set.getValue()));
    });
     */
}

function rand_N(amount, timer) {
    if (!legion) {
        console.warn("Use start first.");
        return;
    }
    var i = setInterval(function () {
        if (amount % 4 == 0)
            printStates();
        if (amount-- <= 0) {
            clearInterval(i);
            return;
        }
        if (Math.random() > 0.35) {
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

    var rand = newRandomValue();
    //op_set.add(rand);
    //state_set.add(rand);
    delta_set.add(rand);
}

function remove() {
    if (!legion) {
        console.warn("Use start first.");
        return;
    }
    console.log("Removing.");
    var r = Math.random();
    /*var op_set_val = op_set.getValue();
    var rem = op_set_val[Math.floor(r * op_set_val.length)];
    if (rem)
        op_set.remove(rem);

    var state_set_val = state_set.getValue();
    var state_set_rem = state_set_val[Math.floor(r * state_set_val.length)];
    if (state_set_rem)
        state_set.remove(state_set_rem);*/
    var delta_set_val = delta_set.getValue();
    var delta_set_rem = delta_set_val[Math.floor(r * delta_set_val.length)];
    if (delta_set_rem)
        delta_set.remove(delta_set_rem);
}

function printvalues() {
    console.log(op_set.getValue().sort());
    console.log(state_set.getValue().sort());
    console.log(delta_set.getValue().sort());
}

function printStates() {

    var size_op_set_no_meta = JSON.stringify(op_set.getValue()).length;
    var size_state_set_no_meta = JSON.stringify(state_set.getValue()).length;
    var size_delta_set_no_meta = JSON.stringify(delta_set.getValue()).length;

    var size_op_set_meta = getSetSize(op_set);
    var size_state_set_meta = getSetSize(state_set);
    var size_delta_set_meta = getSetSize(delta_set);

    console.log("OP " + op_set.getValue().length + " " + size_op_set_meta + " " + size_op_set_no_meta + " " + (size_op_set_no_meta / size_op_set_meta))
    console.log("state " + state_set.getValue().length + " " + size_state_set_meta + " " + size_state_set_no_meta + " " + (size_state_set_no_meta / size_state_set_meta))
    console.log("delta " + delta_set.getValue().length + " " + size_delta_set_meta + " " + size_delta_set_no_meta + " " + (size_delta_set_no_meta / size_delta_set_meta))
}

function getSetSize(crdt) {
    var size = 0;

    var r_keys = crdt.state.removes.keys();
    var a_keys = crdt.state.adds.keys();

    size += JSON.stringify(r_keys).length;
    size += JSON.stringify(a_keys).length;

    for (var i = 0; i < a_keys.length; i++) {
        var e = crdt.state.adds.get(a_keys[i]);
        size += JSON.stringify(e.keys()).length;
    }

    return size;
}