var legions = [];
var currentClient = 0;

var debug = false;
var detailedDebug = false;

console.log("Legion overlay test.");
console.log("Step 1 - run 'run(A,B,C)', A=startingID, B=clients, C=interval(ms)");

function run(start, count, interval) {
    currentClient = 0;
    var int = setInterval(function () {
        if (currentClient++ == count) {
            clearInterval(int)
        } else {
            var options = {
                clientID: start++,
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
            var l = new Legion(options);
            l.join();
            legions.push(l);
        }
    }, interval);
}

function counts() {
    for (var i = 0; i < legions.length; i++)
        console.log(i + " - overlay - " + legions[i].overlay.peerCount());

}