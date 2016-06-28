function CliquesOverlay(overlay, legion) {
    this.overlay = overlay;
    this.legion = legion;

    var so = this;
    this.interval = setInterval(function () {
        so.floodJoin();
    }, 15 * 1000);
    this.started = false;

    setTimeout(function () {
        so.floodJoin();
    }, 3 * 1000);

    this.legion.messagingAPI.setHandlerFor("Connect", function (message, original, connection) {
        so.handleJoin(message, original, connection)
    });
}

CliquesOverlay.prototype.onClientConnection = function (peerConnection) {
    if (this.legion.bullyProtocol.amBullied()) {
        if (this.legion.connectionManager.serverConnection)
            this.legion.connectionManager.serverConnection.socket.close();
    }
    this.floodJoin();
};

CliquesOverlay.prototype.onClientDisconnect = function (peerConnection) {
    //No op.
};

CliquesOverlay.prototype.onServerConnection = function (serverConnection) {
    this.init();
};

CliquesOverlay.prototype.onServerDisconnect = function (serverConnection) {
    //No op.
};

CliquesOverlay.prototype.init = function (contact_node) {
    this.floodJoin();
};

CliquesOverlay.prototype.floodJoin = function () {
    //random sample of peers

    if (!this.started) {
        var serverConnection = this.legion.connectionManager.serverConnection;

        if (!serverConnection) {
            //this forces a connection to the server.
            if (!this.legion.bullyProtocol.amBullied()) {
                this.legion.connectionManager.startSignallingConnection();
            }
        }
        this.started = true;
    }
    var so = this;
    this.legion.generateMessage("Connect", null, function (result) {
        so.legion.messagingAPI.broadcastMessage(result);
    });
};

CliquesOverlay.prototype.handleJoin = function (message, original, connection) {
    if (!this.legion.connectionManager.hasPeer(message.sender)) {
        if (this.overlay.peerCount() <= 1)
            this.legion.connectionManager.connectPeer(message.sender);
    }

    this.legion.messagingAPI.broadcastMessage(original, [connection]);

    if (this.legion.bullyProtocol.amBullied()) {
        if (this.legion.connectionManager.serverConnection) {
            this.legion.connectionManager.serverConnection.close()
        }
    }
};