var PORT = 8002;

var SERVER_HB_INTERVAL = 25000;

var D = require('./../shared/Duplicates.js');

var util = require('util');
var WebSocket = require('ws');
var storage = require('node-persist');

var WebSocketServer;
var wss;

var ALMap = require('./../shared/ALMap.js').ALMap;
var AuthServer = require('./Authserver.js').AuthServer;

initService();
function initService() {
    WebSocketServer = WebSocket.Server;
    wss = new WebSocketServer({
        port: PORT, verifyClient: function (info, cb) {
            cb(true);
        }
    });

    var duplicates = new D.Duplicates();
    var nodes = new ALMap();
    var iterableNodes = [];
    var messageCount = 0;

    //TODO: id is hardcoded.
    //TODO: on server re-boot message generation breaks.
    /**
     *
     * @param type {string}
     * @returns {{type: string, sender: string, ID: number}}
     */
    var generateMessage = function (type) {
        return {
            type: type,
            sender: "SignallingServer",
            ID: ++messageCount
        };
    };

    /**
     *
     * @param sourceID {number}
     * @param TargetID {number}
     * @returns {number}
     */
    var computeDistance = function (sourceID, TargetID) {
        //TODO: usage?
        return 1;
    };

    var authority = new AuthServer();

    //TODO: well defined security and parameters
    setInterval(function () {
        var HB = generateMessage("SHB");
        HB.timestamp = Date.now();
        HB.validity = 75000;
        HB.KeyID = authority.getCurrentKey().id;
        HB.signature = authority.signedMessageDigest("" + HB.timestamp + HB.ID + HB.KeyID + HB.validity);
        var msg = JSON.stringify(HB);
        for (var i = 0; i < iterableNodes.length; i++) {
            if (iterableNodes[i].readyState == 1) {
                util.log("-Sending HB to " + iterableNodes[i].remoteID);
                iterableNodes[i].send(msg);
            }
        }
    }, SERVER_HB_INTERVAL);

    wss.on('connection', function (socket) {
            util.log("Connection.");
            socket.on('message', function incoming(message) {
                    //util.log(message);
                    //TODO: try catch on parse.
                    var parsed = JSON.parse(message);
                    if (parsed.type == "Auth") {
                        //TODO: again, define security.
                        var auth = authority.verify(parsed);
                        socket.send(JSON.stringify(auth));
                        if (auth.auth.result == "Failed") {
                            socket.close();
                        }
                    } else {
                        if (!duplicates.contains(parsed.sender, parsed.ID)) {
                            duplicates.add(parsed.sender, parsed.ID);
                            if (!socket.remoteID) {
                                if (nodes.contains(parsed.sender)) {
                                    util.log("Reconnected with new socket " + parsed.sender);
                                } else {
                                    util.log("Connected " + parsed.sender);
                                }
                                socket.remoteID = parsed.sender;
                                nodes.set(parsed.sender, socket);
                                iterableNodes.push(socket);
                            }

                            if (parsed.destination != null) {
                                //Try to send do destination, on failure back to default behaviour.
                                var node = nodes.get(parsed.destination);
                                if (node && node.readyState == 1) {
                                    util.log("Destination message: " + parsed.type);
                                    util.log("   Sending to " + parsed.destination);
                                    nodes.get(parsed.destination).send(message);
                                    return;
                                }
                            }
                            if (parsed.type == "GetClosestContact") {
                                util.log("GetClosestContact: " + parsed.targetID + " - " + parsed.sender);
                                var targetID = parsed.targetID;
                                var ids = nodes.keys();
                                var closestDistance = null;
                                var closestIdentifier = null;
                                for (var i = 0; i < ids.length; i++) {
                                    if (nodes.get(ids[i]) === socket) continue;
                                    if (nodes.get(ids[i]).readyState == 1 && (closestDistance == null || computeDistance(targetID, ids[i].remoteID) < closestDistance)) {
                                        closestDistance = computeDistance(targetID, ids[i].remoteID);
                                        closestIdentifier = ids[i];
                                    }
                                }
                                util.log("Value of closestIdentifier: " + closestIdentifier);
                                var reply = generateMessage("GetClosestContactReply");
                                reply.destination = parsed.sender;
                                if (closestIdentifier != null) {
                                    //util.log("   Sending to " + closestIdentifier);
                                    //nodes.get(closestIdentifier).send(message);
                                    //Notify the new node that its connection request has been forwarded to someone.
                                    reply.contactID = closestIdentifier;
                                    util.log("   Sending to " + socket.remoteID);
                                    socket.send(JSON.stringify(reply));
                                } else {
                                    //Notify the new node that he is the first one arriving.
                                    reply.contactID = null;
                                    util.log("   Sending to " + socket.remoteID);
                                    socket.send(JSON.stringify(reply));
                                }

                            } else if (parsed.howMany) {
                                util.log("Sending howMany " + parsed.type + " - " + parsed.howMany);
                                var sent = 0;
                                var i = Math.floor(Math.random() * iterableNodes.length);
                                for (var count = 0; sent < parsed.howMany && count < iterableNodes.length; count++) {
                                    if (iterableNodes[i].readyState == 1 && !(iterableNodes[i] === socket)) {
                                        if (iterableNodes[i].remoteID == parsed.sender)continue;
                                        util.log("   Sending to " + iterableNodes[i].remoteID);
                                        sent++;
                                        parsed.destination = iterableNodes[i].remoteID;
                                        iterableNodes[i].send(JSON.stringify(parsed));
                                    }
                                    i++;
                                    if (i >= iterableNodes.length) i = 0;
                                }
                            } else {
                                util.log("Broadcast: " + parsed.type);
                                var end = iterableNodes.length;
                                if (parsed.N) {
                                    end = Math.min(parsed.N, end);
                                }
                                if (parsed.ttl) {
                                    parsed.ttl--;
                                }

                                for (var i = 0; i < end; i++) {
                                    if (iterableNodes[i] === socket)continue;
                                    if (iterableNodes[i].remoteID == parsed.sender)continue;
                                    if (iterableNodes[i].readyState == 1) {
                                        util.log("   Sending to " + iterableNodes[i].remoteID);
                                        iterableNodes[i].send(message);
                                    }
                                }
                            }

                            var keys = nodes.keys();
                            iterableNodes = [];
                            for (var i = 0; i < keys.length; i++) {
                                if (nodes.get(keys[i]).readyState == 1) {
                                    iterableNodes.push(nodes.get(keys[i]));
                                } else {
                                    util.log("Disconnected " + keys[i]);
                                    nodes.delete(keys[i]);
                                }
                            }
                            iterableNodes = shuffle(iterableNodes);
                        }
                    }
                }
            );
            socket.on('disconnect', function () {
                util.log("Disconnected " + socket.remoteID);
            });
        }
    )
}

/**
 *
 * Copypasta from http://stackoverflow.com/a/962890
 * @param array {Array.<Object>}
 * @returns {Array.<Object>}
 */
var shuffle = function (array) {
    var tmp, current, top = array.length;
    if (top) while (--top) {
        current = Math.floor(Math.random() * (top + 1));
        tmp = array[current];
        array[current] = array[top];
        array[top] = tmp;
    }
    return array;
};
