function Legion(options) {
    this.options = options;
    this.joined = false;
    this.onJoinCallback = null;

    if (!options.clientID) {
        options.clientID = this.randInt();
    }
    if (!options.overlayProtocol) {
        options.overlayProtocol = B2BOverlay;
    }
    if (!options.messagingProtocol) {
        options.messagingProtocol = FloodMessaging;
    }
    if (!options.objectOptions) {
        options.objectOptions = {
            serverInterval: 5000,
            peerInterval: 200
        };
    }
    if (!options.bullyProtocol) {
        options.bullyProtocol = {
            type: ServerBully
        };
    }
    if (!options.signallingConnection) {
        options.signallingConnection = {
            type: ServerConnection,
            server: {ip: "localhost", port: 8002}
        };
    }
    if (!options.objectServerConnection) {
        options.objectServerConnection = {
            type: ObjectServerConnection,
            server: {ip: "localhost", port: 8004}
        };
    }
    if (!options.securityProtocol) {
        options.securityProtocol = SecurityProtocol;
    }
    //TODO: this seems a bad fix:
    this.messageCount = this.randInt();
    this.id = this.options.clientID;

    //TODO: the following should have a well defined order
    this.messagingAPI = new MessagingAPI(this);
    if (this.options.bullyProtocol)
        this.bullyProtocol = new this.options.bullyProtocol.type(this);
    this.overlay = new Overlay(this, this);
    this.connectionManager = new ConnectionManager(this);


    //TODO: this should be instantiated.
    this.objectStore = null;
}
/**
 * Joins the overlay.
 */
Legion.prototype.join = function () {
    //TODO: why is security being started here?
    this.secure = new this.options.securityProtocol(this);
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
    //TODO: remove instantiating from here.
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
    //TODO: this should not be accessible from the outside.
    //TODO: define a way to sign messages
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
    //TODO: this seems like a hammered fix.
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
    //TODO: this should be fixed.
    return Date.now();
};

/**
 * Returns a random integer.
 * @returns {number}
 */
Legion.prototype.randInt = function () {
    //TODO: why does the API export this?
    return Math.floor((Math.random() * Number.MAX_VALUE) % (Math.pow(10, 10)));
};

/**
 * Sets a callback which is called when a connection is first established to a signalling server.
 * If a connection has already been made the callback is called immediately.
 * @param callback {Function}
 */
Legion.prototype.onJoin = function (callback) {
    if (this.joined) {
        callback();
    } else {
        this.onJoinCallback = callback;
    }
};

Legion.prototype.onOpenServer = function (serverConnection) {
    //TODO: signalling is seperate from secure and from data.
    //TODO: error on verifying permissions to server.
    if (!this.joined) {
        this.joined = true;
        if (this.onJoinCallback) {
            this.onJoinCallback();
            this.onJoinCallback = null;
        }
    }
};