var legion;
var messaging;

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