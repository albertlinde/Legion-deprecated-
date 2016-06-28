function ConnectionManager(legion) {
    this.legion = legion;
    this.serverConnection = null;

    this.peerConnections = new ALMap();

    var cm = this;
    //TODO: the following strings are defined where?
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
    //TODO: this if is not enough: concurrent calls to the method.
    if (!this.serverConnection)
        new this.legion.options.signallingConnection.type(this.legion.options.signallingConnection.server, this.legion);
};

ConnectionManager.prototype.hasPeer = function (peerID) {
    return this.peerConnections.contains(peerID);
};

//assumes peer does not exist
ConnectionManager.prototype.connectPeer = function (peerID) {
    //TODO: remove assumption
    if (this.hasPeer(peerID)) {
        return false;
    } else {
        this.peerConnections.set(peerID, new PeerConnection(peerID, this.legion));
        this.peerConnections.get(peerID).startLocal();
        return true;
    }
};

//if it had the peer, the winning started is te one with lowest id.
ConnectionManager.prototype.connectPeerRemote = function (message) {
    //TODO: decision is based by id. is this the best way?
    var peerID = message.sender;
    var offer = message.content;
    var hadPeer = this.peerConnections.get(peerID);
    if (hadPeer) {
        if (peerID < this.legion.id) {
            //He wins.
            this.peerConnections.get(peerID).cancelAll();
            this.peerConnections.set(peerID, new PeerConnection(peerID, this.legion));
            this.peerConnections.get(peerID).startRemote(offer, message.unique);
        } else {
            //I win.
        }
    } else {
        this.peerConnections.set(peerID, new PeerConnection(peerID, this.legion));
        this.peerConnections.get(peerID).startRemote(offer, message.unique);
    }
};

ConnectionManager.prototype.handleSignalling = function (message, original) {
    //TODO: again, this isn't well defined.
    //TODO: message.unique is not explained anywhere.
    if (message.destination != this.legion.id) {
        this.legion.messagingAPI.broadcastMessage(original);
    } else {
        if (message.type == "OfferAsAnswer") {
            this.connectPeerRemote(message);
        } else {
            var unique = message.unique;
            if (this.peerConnections.contains(message.sender)) {
                var pc = this.peerConnections.get(message.sender);
                if (pc.unique != unique) {
                    console.warn("Got as unique", unique, "when expecting", pc.unique);
                } else {
                    switch (message.type) {
                        case "OfferReturn":
                            pc.returnOffer(message.content);
                            return;
                        case "ICE":
                            pc.return_ice(message.content);
                            return;
                    }
                }
            } else {
                console.warn("Got", message.type, "for no peer", message.sender, this.legion.id);
            }
        }
    }
};

ConnectionManager.prototype.onCloseServer = function (serverConnection) {
    console.log(this.legion.getTime() + " Overlay CLOSE " + this.legion.id + " to " + serverConnection.remoteID + " of type " + (serverConnection.constructor.name));
    this.serverConnection = null;
    if (serverConnection instanceof this.legion.options.signallingConnection.type) {
        this.serverConnection = null;
        this.legion.overlay.onServerDisconnect(serverConnection);
    }
    //TODO: the internal if vill be void.
    if (serverConnection instanceof this.legion.options.objectServerConnection.type) {
        if (this.legion.objectStore)
            this.legion.objectStore.onServerDisconnect(serverConnection);
        else
            console.error("Should not disconnect form objects server when not having an objects store!")
    }
    if (this.legion.bullyProtocol)
        this.legion.bullyProtocol.onServerDisconnect(serverConnection);
};

ConnectionManager.prototype.onOpenServer = function (serverConnection) {
    //TODO: this should be individual for server types
    console.log(this.legion.getTime() + " Overlay OPEN " + this.legion.id + " to " + serverConnection.remoteID + " of type " + (serverConnection.constructor.name));
    if (serverConnection instanceof this.legion.options.signallingConnection.type) {
        this.serverConnection = serverConnection;
        this.legion.overlay.onServerConnection(serverConnection);
    }
    if (serverConnection instanceof this.legion.options.objectServerConnection.type) {
        if (this.legion.objectStore)
            this.legion.objectStore.onServerConnection(serverConnection);
        else
            console.error("Should not connect to objects server when not having an objects store!")
    }
    if (this.legion.bullyProtocol)
        this.legion.bullyProtocol.onServerConnection(serverConnection);
    this.legion.onOpenServer(serverConnection);
};

ConnectionManager.prototype.onOpenClient = function (clientConnection) {
    console.log(this.legion.getTime() + " Overlay OPEN " + this.legion.id + " to " + clientConnection.remoteID);
    this.legion.overlay.addPeer(clientConnection);
    //TODO: the ifs will be void.
    if (this.legion.objectStore)
        this.legion.objectStore.onClientConnection(clientConnection);
    if (this.legion.bullyProtocol)
        this.legion.bullyProtocol.onClientConnection(clientConnection);
};

ConnectionManager.prototype.onCloseClient = function (clientConnection) {
    console.log(this.legion.getTime() + " Overlay CLOSE " + this.legion.id + " to " + clientConnection.remoteID);
    this.peerConnections.delete(clientConnection.remoteID);
    this.legion.overlay.removePeer(clientConnection);
    //TODO: the ifs will be void.
    if (this.legion.objectStore)
        this.legion.objectStore.onClientDisconnect(clientConnection);
    if (this.legion.bullyProtocol)
        this.legion.bullyProtocol.onClientDisconnect(clientConnection);
};

ConnectionManager.prototype.sendStartOffer = function (offer, unique, clientConnection) {
    var cm = this;
    //TODO: see CM.constructor
    this.legion.generateMessage("OfferAsAnswer", offer, function (result) {
        result.destination = clientConnection.remoteID;
        result.unique = unique;
        cm.legion.messagingAPI.broadcastMessage(result);
    });
};

ConnectionManager.prototype.sendReturnOffer = function (offer, unique, clientConnection) {
    var cm = this;
    //TODO: see CM.constructor
    this.legion.generateMessage("OfferReturn", offer, function (result) {
        result.destination = clientConnection.remoteID;
        result.unique = unique;
        cm.legion.messagingAPI.broadcastMessage(result);
    });
};

ConnectionManager.prototype.sendICE = function (candidate, unique, clientConnection) {
    var cm = this;
    //TODO: see CM.constructor
    this.legion.generateMessage("ICE", candidate, function (result) {
        result.destination = clientConnection.remoteID;
        result.unique = unique;
        cm.legion.messagingAPI.broadcastMessage(result);
    });
};


