function SimpleBully(legion) {
    this.legion = legion;
    var sb = this;
    this.handlers = {
        bully: {
            type: "Bully",
            callback: function (message, connection) {
                var hisID = connection.remoteID;
                var time = (new Date.getTime());
                if (!sb.bully || hisID > sb.bully) {
                    sb.bully = hisID;
                    sb.lastBullyMessage = time;
                } else {
                    console.log("Be bullied by", hisID, "but mine is", sb.bully);
                }

            }
        }
    };

    this.bully = null;
    this.lastBullyMessage = null;

    this.bullyMustHaveInterval = 15 * 1000;
    this.bullySendInterval = 7 * 1000;
    this.bullyStartTime = 7 * 1000;

    setTimeout(function () {
            sb.interval = setInterval(function () {
                sb.floodBully();
            }, sb.bullySendInterval);
        },
        sb.bullyStartTime);

    this.legion.messagingAPI.setHandlerFor(this.handlers.bully.type, this.handlers.bully.callback);
}

SimpleBully.prototype.onClientConnection = function (peerConnection) {
    //No op.
};

SimpleBully.prototype.onClientDisconnect = function (peerConnection) {
    //No op.
};

SimpleBully.prototype.onServerConnection = function (serverConnection) {
    //No op.
};

SimpleBully.prototype.onServerDisconnect = function (serverConnection) {
    //No op.
};

/**
 * Returns true if node has a bully.
 * False if the node is itself a bully.
 * NOTE: true on startup.
 * @returns {boolean}
 */
SimpleBully.prototype.amBullied = function () {
    if (!this.lastBullyMessage || !this.bully)
        return false;
    if (this.bully == this.legion.id)
        return false;
    var time = (new Date().getTime()) - this.lastBullyMessage;
    return time > this.bullyMustHaveInterval;
};

SimpleBully.prototype.floodBully = function () {
    if (!this.amBullied()) {
        console.log("Being bully.");

        this.bully = this.legion.id;
        this.lastBullyMessage = (new Date().getTime());

        var sb = this;
        this.legion.generateMessage(this.handlers.bully.type, null, function (result) {
            var peers = sb.legion.overlay.getPeers(sb.legion.overlay.peerCount());

            for (var i = 0; i < peers.length; i++) {
                console.log("Being bully to", peers[i].remoteID);
                peers[i].send(result);
            }
        });
    } else {
        console.log("My bully", this.bully, this.lastBullyMessage);
    }
};
