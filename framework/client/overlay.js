function Overlay(legion) {
    this.legion = legion;
    this.peers = new ALMap();

    this.overlayProtocol = new this.legion.options.overlayProtocol.type(this, this.legion);
    this.onChangeCallback = null;
}

/**
 * Returns number of instantiated peers.
 * @returns {number}
 */
Overlay.prototype.peerCount = function () {
    return this.peers.size();
};

Overlay.prototype.addPeer = function (peerConnection) {
    this.peers.set(peerConnection.remoteID, peerConnection);
    this.overlayProtocol.onClientConnection(peerConnection);
    this.changedOverlay();
};

Overlay.prototype.removePeer = function (peerConnection) {
    this.peers.delete(peerConnection.remoteID);
    this.overlayProtocol.onClientDisconnect(peerConnection);
    this.changedOverlay();
};

Overlay.prototype.onServerDisconnect = function (serverConnection) {
    this.overlayProtocol.onServerDisconnect(serverConnection);
    this.changedOverlay();
};

Overlay.prototype.onServerConnection = function (serverConnection) {
    this.overlayProtocol.onServerConnection(serverConnection);
    this.changedOverlay();
};

Overlay.prototype.changedOverlay = function (change) {
    if (this.onChangeCallback) {
        this.onChangeCallback(change, this.getPeerIDs(), this.getServerIDs());
    }
};

Overlay.prototype.setOnChange = function (callback) {
    this.onChangeCallback = callback;
};

Overlay.prototype.getPeerIDs = function () {
    return this.peers.keys();
};

Overlay.prototype.getServerIDs = function () {
    var servers = [];
    if (!this.legion.bullyProtocol.amBullied()) {
        servers.push("SignallingServer");
        servers.push("ObjectServer");
    }
    return servers;
};

/**
 * Returns a randomized sample from the connected peers.
 * @param amount
 * @returns {Array.<PeerConnection>}
 */
Overlay.prototype.getPeers = function (amount) {
    if (!amount) {
        amount = this.peerCount();
    }
    amount = parseInt(amount);
    if (amount == this.peerCount) {
        return this.peers.values();
    }
    var ret = this.shuffle(this.peers.values());
    return ret.slice(0, amount);
};

/**
 *
 * Copypasta from http://stackoverflow.com/a/962890
 * @param array {Array.<Object>}
 * @returns {Array.<Object>}
 */
Overlay.prototype.shuffle = function (array) {
    //TODO: why is this here?
    var tmp, current, top = array.length;
    if (top) while (--top) {
        current = Math.floor(Math.random() * (top + 1));
        tmp = array[current];
        array[current] = array[top];
        array[top] = tmp;
    }
    return array;
};
