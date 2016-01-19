function Legion(options) {
    this.options = options;

    this.messageCount = 0;
    this.id = this.options.clientID;

    this.messagingAPI = new MessagingAPI(this, this.legion);
    this.overlay = new Overlay(this, this.legion);
    this.connectionManager = new ConnectionManager(this);

    this.objectStore = new ObjectStore(this);
}
/**
 * Joins the overlay.
 */
Legion.prototype.join = function () {
    this.connectionManager.startSignallingConnection();
};
/**
 *
 * @returns {MessagingAPI}
 */
Legion.prototype.getMessageAPI = function () {
    return this.messagingAPI;
};

/**
 *
 * @returns {ObjectStore}
 */
Legion.prototype.getObjectStore = function () {
    return this.objectStore;
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

/**
 * Adds new content to an existing message.
 * Does not override message sender or message id!
 * Will remove existing content (even if no newData is given!).
 * @param oldMessage {{type:String, sender: String, ID: number, content: Object|null}}
 * @param newData {Object|null}
 * @param callback {Function}
 */
Legion.prototype.reGenerateMessage = function (oldMessage, newData, callback) {
    if (!newData) {
        if (oldMessage.content)
            delete oldMessage.content;
        callback(oldMessage);
    } else {
        compress(JSON.stringify(newData), function (response) {
            oldMessage.content = response;
            callback(oldMessage);
        }, function (error) {
            console.error("Compress failed!", error);
            callback(null);
        });
    }
};

/**
 * Returns a number representation of the local clock.
 * @returns {number}
 */
Legion.prototype.getTime = function () {
    return Date.now();
};