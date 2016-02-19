function Legion(options) {
    this.options = options;

    this.messageCount = Math.floor((Math.random() * Number.MAX_VALUE) % (Math.pow(10, 10)));
    this.id = this.options.clientID;

    this.messagingAPI = new MessagingAPI(this);
    if (this.options.bullyProtocol)
        this.bullyProtocol = new this.options.bullyProtocol.type(this);
    this.overlay = new Overlay(this, this);
    this.connectionManager = new ConnectionManager(this);


    this.objectStore = null;
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
    if (!this.objectStore) {
        this.objectStore = new ObjectStore(this);
    }
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
    if (!type) {
        console.error("No type for message.");
        return;
    }
    var message = {
        type: type,
        sender: this.id,
        ID: ++this.messageCount
    };
    if (!data) {
        callback(message);
    } else {
        var json;
        try {
            json = JSON.stringify(data);

        } catch (e) {
            console.error(e);
            console.error(data);

            function censor(censor) {
                //http://stackoverflow.com/a/9653082
                var i = 0;
                return function (key, value) {
                    if (i !== 0 && typeof(censor) === 'object' && typeof(value) == 'object' && censor == value)
                        return '[Circular]';
                    if (i >= 29) // seems to be a harded maximum of 30 serialized objects?
                        return '[Unknown]';
                    ++i; // so we know we aren't using the original object anymore
                    return value;
                }
            }

            console.log("Censoring: ", data);
            console.log("Result: ", JSON.stringify(data, censor(data)));
            return;
        }
        compress(json, function (response) {
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

/**
 * Returns a random integer.
 * @returns {number}
 */
Legion.prototype.randInt = function () {
    return Math.floor((Math.random() * Number.MAX_VALUE) % (Math.pow(10, 10)));
};