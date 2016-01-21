var legions = [];
var currentClient = 0;

var debug = false;
var detailedDebug = false;

console.log("Legion overlay test.");
console.log("Step 1 - run 'run(A,B,C)', A=startingID, B=clients, C=interval(ms)");

function run(start, count, interval) {
    currentClient = start - 1;
    var clientCount = 0;
    var int = setInterval(function () {
        if (clientCount == count) {
            clearInterval(int)
        } else {
            var options = {
                clientID: ++currentClient,
                server: {ip: "localhost", port: 8002},
                overlayProtocol: SimpleOverlay,
                messagingProtocol: FloodMessaging
            };

            legions[currentClient] = new Legion(options);
            legions[currentClient].join();
            clientCount++;
        }

    }, interval);
}