function SimpleOverlay(overlay, legion) {
    this.overlay = overlay;
    this.legion = legion;

    var so = this;
    this.interval = setInterval(function () {
        so.floodJoin();
    }, 15 * 1000);

    this.legion.messagingAPI.setHandlerFor("ConnectToAnyNodesPlease", function (message) {
        so.handleJoin(message)
    });
}

SimpleOverlay.prototype.onClientConnection = function (peerConnection) {
    //No op.
};

SimpleOverlay.prototype.onClientDisconnect = function (peerConnection) {
    //No op.
};

SimpleOverlay.prototype.onServerConnection = function (serverConnection) {
    this.init(serverConnection);
};

SimpleOverlay.prototype.onServerDisconnect = function (serverConnection) {
    //No op.
};

SimpleOverlay.prototype.init = function (contact_node) {
    this.legion.generateMessage("ConnectToAnyNodesPlease", null, function (result) {
        contact_node.send(result);
    });
};

SimpleOverlay.prototype.floodJoin = function () {
    var peers = this.overlay.peers;
    var serverConnection = this.legion.connectionManager.serverConnection;
    if (!serverConnection) {
        this.legion.connectionManager.startSignallingConnection();
    }

    this.legion.generateMessage("ConnectToAnyNodesPlease", null, function (result) {
        if (serverConnection)
            serverConnection.send(result);
        for (var i = 0; i < peers.length; i++) {
            peers[i].send(result);
        }
    });
};

SimpleOverlay.prototype.handleJoin = function (message) {
    if (!this.legion.connectionManager.hasPeer(message.sender)) {
        this.legion.connectionManager.connectPeer(message.sender);
    }
};