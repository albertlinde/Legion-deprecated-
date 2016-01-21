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
    if (this.legion.id % 5 != 0) {
        if (this.legion.connectionManager.serverConnection)
            this.legion.connectionManager.serverConnection.socket.close();
    }
    this.floodJoin();
};

SimpleOverlay.prototype.onClientDisconnect = function (peerConnection) {
    //No op.
};

SimpleOverlay.prototype.onServerConnection = function (serverConnection) {
    this.init();
};

SimpleOverlay.prototype.onServerDisconnect = function (serverConnection) {
    //No op.
};

SimpleOverlay.prototype.init = function (contact_node) {
    this.floodJoin();
};

SimpleOverlay.prototype.floodJoin = function () {
    //random sample of peers
    var peers = this.overlay.getPeers(this.overlay.peerCount());

    var serverConnection = this.legion.connectionManager.serverConnection;

    if (!serverConnection) {
        //this forces a connection to the server.
        if (this.legion.id % 5 == 0) {
            this.legion.connectionManager.startSignallingConnection();
        }
    }

    var so = this;
    this.legion.generateMessage("ConnectToAnyNodesPlease", null, function (result) {
        so.legion.messagingAPI.broadcastMessage(result);
    });
};

SimpleOverlay.prototype.handleJoin = function (message) {
    if (!this.legion.connectionManager.hasPeer(message.sender)) {
        this.legion.connectionManager.connectPeer(message.sender);
    }
};