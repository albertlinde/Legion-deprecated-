var bullyLog = true;
function ServerBully(legion) {
    this.legion = legion;

    this.lastSHB = null;

    var sb = this;
    this.handlers = {
        bully: {
            type: "SHB",
            callback: function (message, original, connection) {
                if (connection instanceof ServerConnection) {
                    sb.lastSHB = message;
                    if (message.ID > sb.legion.secure.getCurrentKeyID()) {
                        connection.socket.send(sb.legion.secure.getServerAuthenticationChallenge());
                    } else
                        sb.floodBully();
                } else {
                    if (sb.legion.secure.verifySHB(message)) {
                        var hisID = connection.remoteID;
                        if (hisID <= sb.bully) {
                            sb.bully = hisID;
                            sb.bullied();
                            if (typeof bullyLog != "undefined" && bullyLog)console.log("Be bullied by", hisID);
                        } else {
                            if (typeof bullyLog != "undefined" && bullyLog)console.log("Be bullied by", hisID, "but mine is", sb.bully);
                            sb.onClientConnection(connection);
                        }
                    } else {
                        console.warn("Error on verifying SHB");
                        //No op.
                    }
                }
            }
        }
    };

    this.bully = (this.legion.id).toString();
    this.legion.messagingAPI.setHandlerFor(this.handlers.bully.type, this.handlers.bully.callback);
    this.callbacks = [];
}

ServerBully.prototype.setOnBullyCallback = function (cb) {
    this.callbacks.push(cb);
};

ServerBully.prototype.bullied = function () {
    var arg = this.amBullied();
    for (var i = 0; i < this.callbacks.length; i++) {
        this.callbacks[i](arg);
    }
};

ServerBully.prototype.onClientConnection = function (peerConnection) {
    if (peerConnection.remoteID > this.legion.id && this.lastSHB) {
        if (typeof bullyLog != "undefined" && bullyLog)console.log("Being immediate bully to", peerConnection.remoteID);
        if (this.lastSHB)
            peerConnection.send(this.lastSHB);
    }
};

ServerBully.prototype.onClientDisconnect = function (peerConnection) {
    //No op.
};

ServerBully.prototype.onServerConnection = function (serverConnection) {
    //No op.
};

ServerBully.prototype.onServerDisconnect = function (serverConnection) {
    //No op.
};

/**
 * Returns true if node has a bully.
 * False if the node is itself a bully.
 * NOTE: true on startup.
 * @returns {boolean}
 */
ServerBully.prototype.amBullied = function () {
    if (this.bully == (this.legion.id).toString() || this.bully == "TEMP_ID" || !this.lastSHB)
        return false;
    var time = (Date.now()) - (this.lastSHB.timestamp + this.lastSHB.validity);
    return time <= 0;
};

ServerBully.prototype.floodBully = function () {
    if (!this.amBullied()) {
        this.bullied();
        this.bully = (this.legion.id).toString();

        var sb = this;
        var peers = sb.legion.overlay.getPeers(sb.legion.overlay.peerCount());

        for (var i = 0; i < peers.length; i++) {
            if (typeof bullyLog != "undefined" && bullyLog)console.log("Being bully to", peers[i].remoteID);
            peers[i].send(this.lastSHB);
        }
    } else {
        if (typeof bullyLog != "undefined" && bullyLog)console.log("My bully", this.bully, this.lastBullyMessage);
    }
};
