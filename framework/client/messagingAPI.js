//TODO: make debugging useful.
//TODO: the whole compression, encryption and signing part looks hacked into the code.
function MessagingAPI(legion) {
    this.legion = legion;
    this.messagingProtocol = new this.legion.options.messagingProtocol(this, this.legion);
    //TODO: inner and outer(application) callback handlers
    this.callbacks = new ALMap();
    this.duplicates = new Duplicates();
}

/**
 * Handles message reception.
 * @param connection {PeerConnection,ServerConnection}
 * @param message {Object}
 * @param original {Object}
 */
MessagingAPI.prototype.onMessage = function (connection, message, original) {
    //TODO: none of the following checks are well defined or justified.
    if (message.sender == this.legion.id) {
        console.warn("Return to creator fault", message, connection.remoteID);
        return;
    }
    if (message.type == "SHB" || !this.duplicates.contains(message.sender, message.ID)) {
        this.duplicates.add(message.sender, message.ID)
    } else {
        //console.log("Duplicate: (" + message.sender + "," + message.ID + ")");
        return;
    }

    if (debug)console.log(message.type + " from " + connection.remoteID + " by " + message.sender + " to " + message.destination);
    if (detailedDebug)console.log(message);

    if (!message.destination || (message.destination && message.destination == this.legion.id)) {
        this.deliver(message, original, connection);
    } else {
        this.messagingProtocol.onMessage(connection, message, original);
    }
};

/**
 * Used by legion to deliver received messages to Legion or the application.
 * @param message
 * @param original
 * @param connection
 */
MessagingAPI.prototype.deliver = function (message, original, connection) {
    //TODO: tis should not be given to the outside world.
    if (this.callbacks.contains(message.type)) {
        message.data = message.content;

        var mapi = this;
        try {
            decompress(message.data, function (result) {
                message.data = JSON.parse(result);
                mapi.callbacks.get(message.type)(message, original, connection);
            });
        } catch (e) {
            mapi.callbacks.get(message.type)(message, original, connection);
        }
    } else {
        console.warn("can't deliver: no handler defined", JSON.stringify(message));
    }
};

/**
 * Used by legion to broadcast messages.
 * @param message
 * @param except
 */
MessagingAPI.prototype.broadcastMessage = function (message, except) {
    //TODO: except shouldn't be given to applications(see this.sendTo).
    this.messagingProtocol.broadcastMessage(message, except);
};

/**
 * Used by legion to unicast messages.
 * @param peer
 * @param message
 */
MessagingAPI.prototype.sendTo = function (peer, message) {
    //TODO: to fine grained control for applications at this level.
    if (message.destination) {
        console.warn("Notice: message had a pre-defined destination!")
    }
    this.messagingProtocol.sendTo(peer, message);
};

/**
 * Propagates a message to a given amount of peers.
 * message.N is divided over all peers.
 * if the second argument is true, all peers get (at most) message.N = 1 and
 * the rest of N is sent to the signalling server.
 * If N is lower than the number of peers, message is sent to a subset of peers and never to the server.
 * @param message
 * @param toServerIfBully
 */
MessagingAPI.prototype.propagateToN = function (message, toServerIfBully) {
    //TODO: see this.sendTo
    if (!message.N) {
        console.error("NO N!");
        return;
    }
    var peers = this.legion.overlay.getPeers(message.N);

    var firstSet = 0;
    var secondSet = 0;
    var firstSetAmount = 0;
    var toServer = 0;

    if (toServerIfBully && this.legion.bullyProtocol.amBully()) {
        firstSet = 0;
        secondSet = 1;
        firstSetAmount = 0;
        toServer = message.N - peers.length;
    } else {
        var amount = Math.floor(message.N / peers.length);
        firstSet = amount + 1;
        secondSet = amount;
        firstSetAmount = Math.ceil(message.N % peers.length);
        toServer = message.N - peers.length;
    }

    var messageFirstSet = JSON.parse(JSON.stringify(message));
    messageFirstSet.N = firstSet;
    var messageSecondSet = JSON.parse(JSON.stringify(message));
    messageSecondSet.N = secondSet;

    for (var i = 0; i < firstSetAmount; i++) {
        if (peers[i].remoteID != message.sender) {
            peers[i].send(messageFirstSet);
        } else {
            toServer++;
        }
    }
    for (var i = firstSetAmount; i < peers.length; i++) {
        if (peers[i].remoteID != message.sender) {
            peers[i].send(messageSecondSet);
        } else {
            toServer++;
        }
    }

    if (toServer > 0 && toServerIfBully && this.legion.bullyProtocol.amBully()) {
        var messageServer = JSON.parse(JSON.stringify(message));
        messageServer.N = toServer;
        if (this.legion.connectionManager.serverConnection && this.legion.connectionManager.serverConnection.isAlive()) {
            this.legion.connectionManager.serverConnection.send(messageServer);
        }
    }
};

/**
 * Calls the current protocol broadcastMessage.
 * @param type {String}
 * @param data {Object}
 */
MessagingAPI.prototype.broadcast = function (type, data) {
    var mapi = this;
    //TODO: a way to internally sing messages would be nice
    this.legion.generateMessage(type, data, function (result) {
        mapi.broadcastMessage(result);
        mapi.deliver(result);
    });
};

/**
 * The callback is called on each message, with two arguments.
 * The first parameter has content parsed.
 * The second can be used to propagate an (unchanged) content.
 * @param type {String}
 * @param callback {Function}
 */
MessagingAPI.prototype.setHandlerFor = function (type, callback) {
    this.callbacks.set(type, callback);
};