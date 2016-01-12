function Overlay(legion) {
    this.legion = legion;
    this.peers = new ALMap();

    this.overlayProtocol = new this.legion.options.overlayProtocol(this, this.legion);
}

Overlay.prototype.peerCount = function () {
    return this.peers.size();
};

Overlay.prototype.addPeer = function (peerConnection) {
    this.peers.set(peerConnection.remoteID, peerConnection);
    this.overlayProtocol.onClientConnection(peerConnection);
};

Overlay.prototype.removePeer = function (peerConnection) {
    this.peers.delete(peerConnection.remoteID);
    this.overlayProtocol.onClientDisconnect(peerConnection);
};

Overlay.prototype.onServerDisconnect = function (serverConnection) {
    this.overlayProtocol.onServerDisconnect(serverConnection);
};

Overlay.prototype.onServerConnection = function (serverConnection) {
    this.overlayProtocol.onServerConnection(serverConnection);
};

Overlay.prototype.getPeers = function (amount) {
    var ret = this.peers.values();
    //TODO: randomize the sample.
    return ret.slice(0, amount);
};