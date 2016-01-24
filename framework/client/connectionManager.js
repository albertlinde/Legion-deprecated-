function ConnectionManager(legion) {
    this.legion = legion;
    this.serverConnection = null;

    this.peerConnections = new ALMap();

    var cm = this;
    this.legion.messagingAPI.setHandlerFor("OfferAsAnswer", function (message, original) {
        cm.handleSignalling(message, original)
    });
    this.legion.messagingAPI.setHandlerFor("OfferReturn", function (message, original) {
        cm.handleSignalling(message, original)
    });
    this.legion.messagingAPI.setHandlerFor("ICE", function (message, original) {
        cm.handleSignalling(message, original)
    });

}

ConnectionManager.prototype.startSignallingConnection = function () {
    new this.legion.options.signallingConnection.type(this.legion.options.signallingConnection.server, this.legion);
};


ConnectionManager.prototype.hasPeer = function (peerID) {
    return this.peerConnections.contains(peerID);
};

//assumes peer does not exist
ConnectionManager.prototype.connectPeer = function (peerID) {
    this.peerConnections.set(peerID, new PeerConnection(peerID, this.legion));
    this.peerConnections.get(peerID).startLocal();
};

//no longer assumes peer does not exist
//if it had the peer, the winning started is te one with lowest id.
ConnectionManager.prototype.connectPeerRemote = function (message) {
    var peerID = message.sender;
    var offer = message.content;
    var hadPeer = this.peerConnections.get(peerID);
    if (hadPeer) {
        if (peerID < this.legion.id) {
            //He wins.
            this.peerConnections.get(peerID).cancelAll();
            this.peerConnections.delete(peerID);
            this.peerConnections.set(peerID, new PeerConnection(peerID, this.legion));
            this.peerConnections.get(peerID).startRemote(offer);
        } else {
            //I win.
        }
    } else {
        this.peerConnections.set(peerID, new PeerConnection(peerID, this.legion));
        this.peerConnections.get(peerID).startRemote(offer);
    }
};

ConnectionManager.prototype.handleSignalling = function (message, original) {
    if (message.destination != this.legion.id) {
        this.legion.messagingAPI.broadcastMessage(original);
    } else {
        switch (message.type) {
            case "OfferAsAnswer":
                this.connectPeerRemote(message);
                return;
            case "OfferReturn":
                this.peerConnections.get(message.sender).returnOffer(message.content);
                return;
            case "ICE":
                if (!this.peerConnections.get(message.sender))
                    console.warn("ICE for no peer", message, this.legion.id);
                else
                    this.peerConnections.get(message.sender).return_ice(message.content);
                return;
        }
    }
};

ConnectionManager.prototype.onCloseServer = function (serverConnection) {
    console.log(this.legion.getTime() + " Overlay CLOSE " + this.legion.id + " to " + serverConnection.remoteID);
    this.serverConnection = null;
    this.legion.overlay.onServerDisconnect(serverConnection);
    if (this.legion.objectStore)
        this.legion.objectStore.onServerDisconnection(serverConnection);
    if (this.legion.bullyProtocol)
        this.legion.bullyProtocol.onServerDisconnection(serverConnection);
};

ConnectionManager.prototype.onOpenServer = function (serverConnection) {
    console.log(this.legion.getTime() + " Overlay OPEN " + this.legion.id + " to " + serverConnection.remoteID);
    this.serverConnection = serverConnection;
    this.legion.overlay.onServerConnection(serverConnection);
    if (this.legion.objectStore)
        this.legion.objectStore.onServerConnection(serverConnection);
    if (this.legion.bullyProtocol)
        this.legion.bullyProtocol.onServerConnection(serverConnection);
};

ConnectionManager.prototype.onOpenClient = function (clientConnection) {
    console.log(this.legion.getTime() + " Overlay OPEN " + this.legion.id + " to " + clientConnection.remoteID);
    this.legion.overlay.addPeer(clientConnection);
    if (this.legion.objectStore)
        this.legion.objectStore.onClientConnection(clientConnection);
    if (this.legion.bullyProtocol)
        this.legion.bullyProtocol.onClientConnection(clientConnection);
};

ConnectionManager.prototype.onCloseClient = function (clientConnection) {
    console.log(this.legion.getTime() + " Overlay CLOSE " + this.legion.id + " to " + clientConnection.remoteID);
    this.peerConnections.delete(clientConnection.remoteID);
    this.legion.overlay.removePeer(clientConnection);
    if (this.legion.objectStore)
        this.legion.objectStore.onClientDisconnection(clientConnection);
    if (this.legion.bullyProtocol)
        this.legion.bullyProtocol.onClientDisconnection(clientConnection);
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


