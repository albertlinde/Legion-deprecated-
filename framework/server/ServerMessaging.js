if (typeof exports != "undefined") {
    exports.ServerMessaging = ServerMessaging;

    ALMap = require('./../shared/ALMap.js');
    ALMap = ALMap.ALMap;
    ALQueue = require('./../shared/ALQueue.js');
    ALQueue = ALQueue.ALQueue;
    util = require('util');
    Compressor = require('./../shared/Compressor.js');
}

function ServerMessaging(peerSyncs) {
    this.peerSyncs = peerSyncs;
}

ServerMessaging.prototype.sendTo = function (peer, message) {
    message.destination = peer;
    this.broadcastMessage(message, []);
};

ServerMessaging.prototype.broadcastMessage = function (message, except) {
    if (typeof message == "object") {
        message = JSON.stringify(message);
    }
    if (message.destination) {
        if (this.peerSyncs.contains(message.destination)) {
            if (this.peerSyncs.get(message.destination).peerConnection.readyState == 1) {
                this.peerSyncs.get(message.destination).send(message);
                console.log("Sent " + JSON.parse(message).type + " only to " + message.destination);
            } else {
                console.log("ServerMessaging. should remove dead peer.");
            }
        } else {
            return;
        }
    }
    for (var j = 0; except && j < except.length; j++) {
        if (typeof except[j] == "object") {
            except[j] = except[j].remoteID;
        }
    }

    var peers = this.peerSyncs.keys();
    for (var i = 0; i < peers.length; i++) {
        if (peers[i] == message.sender)
            continue;
        var send = true;
        for (var j = 0; send && except && j < except.length; j++)
            if (except[j] && (peers[i] == except[j]))
                send = false;
        if (send) {
            if (this.peerSyncs.get(peers[i]).peerConnection.readyState == 1) {
                console.log("Sent " + JSON.parse(message).type + " to " + peers[i] + " s: " + JSON.parse(message).sender);
                this.peerSyncs.get(peers[i]).send(message);
            } else {
                console.log("ServerMessaging. should remove dead peer.");
            }
        }
    }
};