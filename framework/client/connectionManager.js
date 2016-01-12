function ConnectionManager(legion) {
    this.legion = legion;
    this.serverConnection = null;

    this.peerConnections = new ALMap();

    var cm = this;
    this.legion.messagingAPI.setHandlerFor("OfferAsAnswer", function (message) {
        cm.handleSignalling(message)
    });
    this.legion.messagingAPI.setHandlerFor("OfferReturn", function (message) {
        cm.handleSignalling(message)
    });
    this.legion.messagingAPI.setHandlerFor("ICE", function (message) {
        cm.handleSignalling(message)
    });

}

ConnectionManager.prototype.startSignallingConnection = function () {
    new ServerConnection(this.legion);
};


ConnectionManager.prototype.hasPeer = function (peerID) {
    return this.peerConnections.contains(peerID);
};

//assumes peer does not exist
ConnectionManager.prototype.connectPeer = function (peerID) {
    this.peerConnections.set(peerID, new PeerConnection(peerID, this.legion));
    this.peerConnections.get(peerID).startLocal();
};

//assumes peer does not exist
ConnectionManager.prototype.connectPeerRemote = function (message) {
    var peerID = message.sender;
    var offer = message.content;
    this.peerConnections.set(peerID, new PeerConnection(peerID, this.legion));
    this.peerConnections.get(peerID).startRemote(offer);
};

ConnectionManager.prototype.handleSignalling = function (message) {
    if (message.destination != this.legion.id) {
        this.legion.messagingAPI.broadcastMessage(message);
    } else {
        switch (message.type) {
            case "OfferAsAnswer":
                this.connectPeerRemote(message);
                return;
            case "OfferReturn":
                this.peerConnections.get(message.sender).returnOffer(message.content);
                return;
            case "ICE":
                this.peerConnections.get(message.sender).return_ice(message.content);
                return;
        }
    }
};

ConnectionManager.prototype.onCloseServer = function (serverConnection) {
    console.log(this.legion.getTime() + " Overlay CLOSE " + this.legion.id + " to " + serverConnection.remoteID);
    this.serverConnection = null;
    this.legion.overlay.onServerDisconnect(serverConnection);
};

ConnectionManager.prototype.onOpenServer = function (serverConnection) {
    console.log(this.legion.getTime() + " Overlay OPEN " + this.legion.id + " to " + serverConnection.remoteID);
    this.serverConnection = serverConnection;
    this.legion.overlay.onServerConnection(serverConnection);
};

ConnectionManager.prototype.onOpenClient = function (clientConnection) {
    console.log(this.legion.getTime() + " Overlay OPEN " + this.legion.id + " to " + clientConnection.remoteID);
    this.legion.overlay.addPeer(clientConnection);
};

ConnectionManager.prototype.onCloseClient = function (clientConnection) {
    console.log(this.legion.getTime() + " Overlay CLOSE " + this.legion.id + " to " + clientConnection.remoteID);
    this.peerConnections.delete(clientConnection.remoteID);
    this.legion.overlay.removePeer(clientConnection);
};

ConnectionManager.prototype.sendStartOffer = function (offer, clientConnection) {
    var cm = this;
    this.legion.generateMessage("OfferAsAnswer", offer, function (result) {
        result.destination = clientConnection.remoteID;
        cm.legion.messagingAPI.broadcastMessage(result);
    });
};

ConnectionManager.prototype.sendReturnOffer = function (offer, clientConnection) {
    var cm = this;
    this.legion.generateMessage("OfferReturn", offer, function (result) {
        result.destination = clientConnection.remoteID;
        cm.legion.messagingAPI.broadcastMessage(result);
    });
};

ConnectionManager.prototype.sendICE = function (candidate, clientConnection) {
    var cm = this;
    this.legion.generateMessage("ICE", candidate, function (result) {
        result.destination = clientConnection.remoteID;
        cm.legion.messagingAPI.broadcastMessage(result);
    });
};


