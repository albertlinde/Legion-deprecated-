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

MessagingAPI.prototype.propagateToN = function (message, toServerIfBully) {
    //TODO: see this.sendTo
    if (!message.N) {
        console.error("NO N!");
        return;
    }
    var peers = this.legion.overlay.getPeers(message.N);
    var missing = 0;
    if (peers.length == message.N) {
        message.N = 1;
    } else {
        missing = message.N - peers.length;
    }
    for (var i = 0; i < peers.length; i++) {
        if (i == 0 && !this.legion.bullyProtocol.amBullied()) {
            var m2 = JSON.parse(JSON.stringify(message));
            m2.N = 1 + missing;
            if (peers[i].remoteID != message.sender) {
                peers[i].send(m2);
            }
        } else {
            if (peers[i].remoteID != message.sender) {
                peers[i].send(message);
            }
        }
    }
    if (!this.legion.bullyProtocol.amBullied()) {
        if (this.legion.connectionManager.serverConnection && this.legion.connectionManager.serverConnection.isAlive()) {
            var m3 = JSON.parse(JSON.stringify(message));
            m3.N = 1 + missing;
            this.legion.connectionManager.serverConnection.send(m3);
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