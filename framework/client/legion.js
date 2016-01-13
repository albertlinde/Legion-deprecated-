function Legion(options) {
    this.options = options;

    this.messageCount = 0;
    this.id = this.options.clientID;

    this.messagingAPI = new MessagingAPI(this, this.legion);
    this.overlay = new Overlay(this, this.legion);
    this.connectionManager = new ConnectionManager(this);
}

Legion.prototype.join = function () {
    this.connectionManager.startSignallingConnection();
};

Legion.prototype.getMessageAPI = function () {
    return this.messagingAPI;
};

/**
 * For generating messages that can be sent.
 * Type is required.
 * Data (optional) is compressed to save bandwidth.
 * @param type {String}
 * @param data {Object}
 * @param callback {Function}
 */
Legion.prototype.generateMessage = function (type, data, callback) {
    var message = {
        type: type,
        sender: this.id,
        ID: ++this.messageCount
    };
    if (!data) {
        callback(message);
    } else {
        compress(JSON.stringify(data), function (response) {
            message.content = response;
            callback(message);
        }, function (error) {
            console.error("Compress failed!", error);
            callback(null);
        });
    }
};

Legion.prototype.getTime = function () {
    return Date.now();
};