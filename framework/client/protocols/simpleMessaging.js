function FloodMessaging(api, legion) {
    this.messagingAPI = api;
    this.legion = legion;
}

FloodMessaging.prototype.onMessage = function (connection, message, original) {
    if (!message.destination || (message.destination && message.destination != this.legion.id)) {
        if (connection instanceof PeerConnection)
            this.broadcastMessage(original, [connection]);
        else {
            if (debug)
                console.log("Not broadcasting: " + message.type, this.legion.id, message.sender)
        }
    }
};

FloodMessaging.prototype.sendTo = function (peer, message) {
    message.destination = peer;
    this.broadcastMessage(message, [this.legion.connectionManager.serverConnection]);
};

//assumes message is ready to be send
/**
 *
 * @param message {Object}
 * @param except {Array.<PeerConnection, ServerConnection>}
 * @param useFanout .{boolean} Ensures sending to subset.
 */
FloodMessaging.prototype.broadcastMessage = function (message, except, useFanout) {
    var peers = this.legion.overlay.getPeers(this.legion.overlay.peerCount());

    if (message.destination) {
        for (var i = 0; i < peers.length; i++) {
            if (peers[i].remoteID == message.destination) {
                peers[i].send(message);
                return;
            }
        }
    }
    var max = peers.length;
    if (useFanout) {
        max = 2;
    }
    var sent = 0;
    for (var i = 0; sent < max && i < peers.length; i++) {
        if (peers[i].remoteID == message.sender)
            continue;
        var send = true;
        for (var j = 0; send && except && j < except.length; j++)
            if (except[j] && (peers[i].remoteID == except[j].remoteID))
                send = false;
        if (send) {
            peers[i].send(message);
            sent++;
        }
    }
    var server = this.legion.connectionManager.serverConnection;
    if (server) {
        for (var i = 0; except && i < except.length; i++)
            if (except[i] && (server.remoteID == except[i].remoteID))
                return;
        server.send(message);
    }
};