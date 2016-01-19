var legion;
var messaging;
var objectStore;

var debug = false;
var detailedDebug = false;

console.log("Legion example.");
console.log("Step 1 - Open various tabs.");
console.log("Step 2 - run 'start(X)' at each tab, with X the tab number.");
console.log("'messaging.broadcast('Message', 'SomeText') sends a message to (all) other nodes.");

function start(clientID) {

    var options = {
        clientID: clientID,
        server: {ip: "localhost", port: 8002},
        overlayProtocol: SimpleOverlay,
        messagingProtocol: FloodMessaging
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
     */
    setInterval(function () {
        messaging.broadcast("Message", "Hello.");
    }, 15 * 1000);

}

var newRandomValue = function () {
    return "randVal" + ("" + Math.random()).substr(2, 2);
};

var counter_state;
var op_set;

function objects() {
    objectStore = legion.getObjectStore();

    objectStore.defineCRDT(CRDT_LIB.STATE_Counter);
    objectStore.defineCRDT(CRDT_LIB.OP_ORSet);

    counter_state = objectStore.get("objectID1", CRDT_LIB.STATE_Counter.type);
    op_set = objectStore.get("objectID2", CRDT_LIB.OP_ORSet.type);

    counter_state.setOnStateChange(function (state) {
        console.log("Counter change: " + JSON.stringify(state) + " value: " + JSON.stringify(counter_state.getValue()));
    });
    op_set.setOnStateChange(function (updates) {
        console.log("Set change: " + JSON.stringify(updates) + " value: " + JSON.stringify(op_set.getValue()));
    });

    setInterval(function () {
        if (Math.random() > 0.2) {
            console.log("Adding.");
            counter_state.increment(legion.id, 1);
            var rand = newRandomValue();
            op_set.add(rand);
        } else {
            console.log("Removing.");
            var rem = op_set.getValue()[0];
            if (rem)
                op_set.remove(op_set.getValue()[0]);
            counter_state.decrement(legion.id, 1);
        }
    }, 5 * 1000);
}
