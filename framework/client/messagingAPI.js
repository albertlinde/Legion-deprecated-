function MessagingAPI(legion) {
    this.legion = legion;
    this.messagingProtocol = new this.legion.options.messagingProtocol(this, this.legion);
    this.callbacks = new ALMap();
    this.duplicates = new Duplicates();
}

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
        this.deliver(message);
    }

    if (debug)console.log(message.type + " from " + connection.remoteID + " by " + message.sender + " to " + message.destination);
    if (detailedDebug)console.log(message);

    this.messagingProtocol.onMessage(connection, message, original);
};

MessagingAPI.prototype.deliver = function (message) {
    if (this.callbacks.contains(message.type)) {
        this.callbacks.get(message.type)(message);
    } else {
        console.warn("can't deliver: no handler defined", JSON.stringify(message));
    }
};

MessagingAPI.prototype.broadcastMessage = function (message) {
    this.messagingProtocol.broadcastMessage(message);
};

MessagingAPI.prototype.broadcast = function (type, data) {
    var mapi = this;
    this.legion.generateMessage(type, data, function (result) {
        mapi.broadcastMessage(result);
    });
};

MessagingAPI.prototype.setHandlerFor = function (type, callback) {
    this.callbacks.set(type, callback);
};