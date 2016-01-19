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

function objects() {
    objectStore = legion.getObjectStore();

    objectStore.defineCRDT(CRDT_LIB.STATE_Counter);
    objectStore.defineCRDT(CRDT_LIB.OP_ORSet);

    var counter_state = objectStore.get("objectID1", CRDT_LIB.STATE_Counter);
    var op_set = objectStore.get("objectID2", CRDT_LIB.OP_ORSet);

    counter_state.setOnStateChange(function (state) {
        //TODO
    });
    op_set.setOnStateChange(function (state, updates) {
        //TODO
    });

    setInterval(function () {
        if (Math.random > 0.3) {
            counter_state.increment();
        } else {
            counter_state.decrement();
        }
    }, 15 * 1000);
}
