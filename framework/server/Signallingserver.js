var Config = require('./config.js');
var Duplicates = require('./../shared/Duplicates.js').Duplicates;

var util = require('util');
var WebSocket = require('ws');

var ALMap = require('./../shared/ALMap.js').ALMap;
var AuthServer = require('./Authserver.js').AuthServer;

initService();

var WebSocketServer;
var wss;
function initService() {
    WebSocketServer = WebSocket.Server;
    wss = new WebSocketServer({
        port: Config.signalling.PORT, verifyClient: function (info, cb) {
            cb(true);
        }
    });

    var duplicates = new Duplicates();

    var messageCount = 0;

    //TODO: on server re-boot message generation breaks.
    /**
     *
     * @param type {string}
     * @returns {{type: string, sender: string, ID: number}}
     */
    var generateMessage = function (type) {
        return {
            type: type,
            sender: Config.signalling.SENDER_ID,
            ID: ++messageCount
        };
    };

    var nodes = new NodesStructure();
    var authority = new AuthServer();

    //TODO: well defined security and parameters
    setInterval(function () {
        var HB = generateMessage("SHB");
        HB.timestamp = Date.now();
        HB.validity = Config.signalling.SERVER_HB_VALIDITY;
        HB.KeyID = authority.getCurrentKey().id;
        HB.signature = authority.signedMessageDigest("" + HB.timestamp + HB.ID + HB.KeyID + HB.validity);
        var msg = JSON.stringify(HB);

        var deadNodes = [];
        for (var i = 0; i < nodes.size(); i++) {
            var node = nodes.getNodeByPos(i);
            if (node.readyState == 1) {
                util.log("   Sending HB to " + node.remoteID);
                node.send(msg);
            } else {
                deadNodes.push(node.remoteID);
            }
        }
        nodes.removeAllNodes(deadNodes);

    }, Config.signalling.SERVER_HB_INTERVAL);

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
                        } else {
                            //TODO: change adding of node to here.
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
                                nodes.addNode(parsed.sender, socket);
                            }

                            if (parsed.destination != null) {
                                //Try to send do destination, on failure back to default behaviour.
                                var node = nodes.getNode(parsed.destination);
                                if (node && node.readyState == 1) {
                                    util.log("Destination message: " + parsed.type);
                                    util.log("   Sending to " + parsed.destination);
                                    node.send(message);
                                    return;
                                }
                            }
                            util.log("Broadcast: " + parsed.type);
                            var end = nodes.size();
                            if (parsed.N) {
                                end = Math.min(parsed.N, end);
                            }
                            if (parsed.ttl) {
                                parsed.ttl--;
                            }
                            var message = JSON.stringify(parsed);
                            var deadNodes = [];
                            for (var i = 0; i < end; i++) {
                                //TODO: if sending to N, randomize the nodes it is sent to.
                                var node = nodes.getNodeByPos(i);
                                if (node === socket)continue;
                                if (node.remoteID == parsed.sender)continue;

                                if (node.readyState == 1) {
                                    util.log("   Sending to " + node.remoteID);
                                    node.send(message);
                                } else {
                                    deadNodes.push(node.remoteID);
                                }
                            }
                            nodes.removeAllNodes(deadNodes);
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

function NodesStructure() {
    this.nodesMap = {};
    this.count = 0;
    this.keys = [];
}

NodesStructure.prototype.size = function () {
    return this.count;
};

NodesStructure.prototype.contains = function (id) {
    return this.nodesMap[id] != null;
};

NodesStructure.prototype.getNode = function (id) {
    return this.nodesMap[id];
};
NodesStructure.prototype.getNodeByPos = function (pos) {
    if (pos == 0) {
        this.keys = Object.keys(this.nodesMap);
    }
    return this.nodesMap[this.keys[pos]];
};

NodesStructure.prototype.addNode = function (id, socket) {
    if (!this.contains(id))
        this.count++;
    this.nodesMap[id] = socket;
    console.log("Added: (" + [id] + "," + this.nodesMap[id].remoteID + ").");
};

NodesStructure.prototype.removeAllNodes = function (idArray) {
    for (var i = 0; i < idArray.length; i++) {
        this.removeNode(idArray[i]);
    }
};

NodesStructure.prototype.removeNode = function (id) {
    if (this.contains(id))
        this.count--;
    delete this.nodesMap[id];
};