function MessagingAPI(legion) {
    this.legion = legion;
    this.messagingProtocol = new this.legion.options.messagingProtocol(this, this.legion);
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
    if (message.sender == this.legion.id) {
        console.warn("Return to creator fault", message, connection.remoteID);
        return;
    }
    if (!this.duplicates.contains(message.sender, message.ID)) {
        this.duplicates.add(message.sender, message.ID)
    } else {
        return;
    }

    if (!message.destination || (message.destination && message.destination == this.legion.id)) {
        this.deliver(message, original, connection);
    }

    if (debug)console.log(message.type + " from " + connection.remoteID + " by " + message.sender + " to " + message.destination);
    if (detailedDebug)console.log(message);

    this.messagingProtocol.onMessage(connection, message, original);
};

/**
 * Used by legion to deliver received messages to Legion or the application.
 * @param message
 * @param original
 */
MessagingAPI.prototype.deliver = function (message, original, connection) {
    if (this.callbacks.contains(message.type)) {
        this.callbacks.get(message.type)(message, original, connection);
    } else {
        console.error("can't deliver: no handler defined", JSON.stringify(message));
    }
};

/**
 * Used by legion to broadcast messages.
 * @param message
 * @param except
 */
MessagingAPI.prototype.broadcastMessage = function (message, except) {
    this.messagingProtocol.broadcastMessage(message, except);
};

/**
 * Used by legion to unicast messages.
 * @param peer
 * @param message
 */
MessagingAPI.prototype.sendTo = function (peer, message) {
    if (message.destination) {
        console.warn("Notice: message had a pre-defined destination!")
    }
    this.messagingProtocol.sendTo(peer, message);
};

/**
 * Calls the current protocol broadcastMessage.
 * @param type {String}
 * @param data {Object}
 */
MessagingAPI.prototype.broadcast = function (type, data) {
    var mapi = this;
    this.legion.generateMessage(type, data, function (result) {
        mapi.broadcastMessage(result);
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