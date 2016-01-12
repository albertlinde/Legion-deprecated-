function FloodMessaging(api, legion) {
    this.messagingAPI = api;
    this.legion = legion;
}

FloodMessaging.prototype.onMessage = function (connection, message, original) {
    if (!message.destination || (message.destination && message.destination != this.legion.id)) {
        this.messagingAPI.messagingProtocol.broadcastMessage(original);
    }
};

//assumes message is ready to be send
FloodMessaging.prototype.broadcastMessage = function (message) {
    var peers = this.legion.overlay.getPeers(this.legion.overlay.peerCount());
    for (var i = 0; i < peers.length; i++) {
        peers[i].send(message);
    }
    var server = this.legion.connectionManager.serverConnection;
    if (server) {
        server.send(message);
    }
};