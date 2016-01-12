var PORT = 8002;

var D = require('./../shared/Duplicates.js');

var util = require('util');
var WebSocket = require('ws');
var storage = require('node-persist');

var WebSocketServer;
var wss;

initService();
function initService() {
    WebSocketServer = WebSocket.Server;
    wss = new WebSocketServer({
        port: PORT, verifyClient: function (info, cb) {
            cb(true);
        }
    });

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
                    if (parsed.type == "Message") {
                        console.log("Not propagating: " + message)
                    } else {
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
                }
            });
            socket.on('disconnect', function () {
                util.log("Disconnected.");
            });
        }
    )
}
