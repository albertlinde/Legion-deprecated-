function FloodMessaging(api, legion) {
    this.messagingAPI = api;
    this.legion = legion;
}

FloodMessaging.prototype.onMessage = function (connection, message, original) {
    if (!message.destination || (message.destination && message.destination != this.legion.id)) {
        if (connection instanceof PeerConnection)
            this.broadcastMessage(original);
        else {
            if (debug)
                console.log("Not broadcasting: " + message.type, this.legion.id, message.sender)
        }
    }
};

FloodMessaging.prototype.sendTo = function (peer, message) {
    message.destination = peer;
    this.broadcastMessage(message);
};

//assumes message is ready to be send
/**
 *
 * @param message {Object}
 * @param except {Array.<PeerConnection, ServerConnection>}
 */
FloodMessaging.prototype.broadcastMessage = function (message, except) {
    var peers = this.legion.overlay.getPeers(this.legion.overlay.peerCount());

    if (message.destination) {
        for (var i = 0; i < peers.length; i++) {
            if (peers[i].remoteID == message.destination) {
                peers[i].send(message);
                return;
            }
        }
    }
    for (var i = 0; i < peers.length; i++) {
        if (peers[i].remoteID == message.sender)
            continue;
        var send = true;
        for (var j = 0; except && j < except.length; j++)
            if (except[j] && (peers[i].remoteID == except[j].remoteID))
                send = false;
        if (send)
            peers[i].send(message);
    }
    var server = this.legion.connectionManager.serverConnection;
    if (server) {
        for (var i = 0; except && i < except.length; i++)
            if (except[i] && (server.remoteID == except[i].remoteID))
                return;
        server.send(message);
    }
};