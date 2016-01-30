function B2BOverlay(overlay, legion) {
    this.overlay = overlay;
    this.legion = legion;

    this.meta_interval = 25 * 1000;

    this.initial_ttl = 3;
    this.initial_n = 5;
    this.min = 4;
    this.max = 6;

    this.conn_check_timeout = 8 * 1000;
    this.conn_check_timeout_startup = 13 * 1000;
    this.conn_check_timeout_multiplier = 1.5;

    this.RAND_VAL = 0.3;

    var bo = this;

    this.legion.messagingAPI.setHandlerFor("P2PMeta", function (message, original, connection) {
        bo.gotP2PMeta(message, original, connection)
    });
    this.legion.messagingAPI.setHandlerFor("JoinRequest", function (message, original, connection) {
        bo.onJoinRequest(message, original, connection)
    });
    this.legion.messagingAPI.setHandlerFor("JoinAnswer", function (message, original, connection) {
        bo.onJoinAnswer(message, original, connection)
    });

    var meta_timeout = function () {
        bo.sendP2PMeta();
        bo.meta_interval = Math.min(bo.meta_interval + 2500, 45 * 1000);
        setTimeout(timeout_check, bo.meta_interval);
    };
    setTimeout(meta_timeout, bo.meta_interval);

    var timeout_check = function () {
        bo.checkIfMustHaveServer();
        var did_reconnect = false;
        if (bo.overlay.peerCount() < bo.min) {
            bo.legion.generateMessage("JoinRequest", null, function (result) {
                result.N = bo.max - bo.overlay.peerCount();
                result.TTL = bo.initial_ttl;
                bo.legion.messagingAPI.propagateToN(result, true);
            });

            did_reconnect = true;
        }
        if (bo.overlay.peerCount() > bo.max) {
            bo.removeBestPeer();
        }
        if (did_reconnect) {
            setTimeout(timeout_check, bo.conn_check_timeout);
        } else {
            setTimeout(timeout_check, Math.min(30, bo.conn_check_timeout * bo.conn_check_timeout_multiplier));
        }
    };

    this.legion.bullyProtocol.setOnBullyCallback(function (b) {
        bo.checkIfMustHaveServer();
    });

    setTimeout(timeout_check, bo.conn_check_timeout_startup);
}

B2BOverlay.prototype.onClientConnection = function (peerConnection) {
    var bo = this;
    this.legion.generateMessage("P2PMeta", null, function (result) {
        result.meta = {
            server: !bo.legion.bullyProtocol.amBullied(),
            peers: bo.legion.overlay.peerCount()
        };
        peerConnection.send(result);
    });
    setTimeout(function () {
        bo.checkIfMustHaveServer()
    }, 300);
};

B2BOverlay.prototype.checkIfMustHaveServer = function () {
    if (this.legion.bullyProtocol.amBullied()) {
        if (this.legion.connectionManager.serverConnection) {
            this.legion.connectionManager.serverConnection.close()
        }
    } else {
        if (!this.legion.connectionManager.serverConnection) {
            this.legion.connectionManager.startSignallingConnection();
        }
    }
};

B2BOverlay.prototype.onClientDisconnect = function (peerConnection) {
    //No op.
};

B2BOverlay.prototype.onServerConnection = function (serverConnection) {
    this.init(serverConnection);
};

B2BOverlay.prototype.onServerDisconnect = function (serverConnection) {
    //No op.
};

B2BOverlay.prototype.init = function (contact_node) {
    var bo = this;
    if (this.overlay.peerCount() > this.min)
        return;
    if (this.overlay.peerCount() == 0) {
        this.legion.generateMessage('JoinRequest', null, function (result) {
            result.N = bo.initial_n;
            result.TTL = bo.initial_ttl;
            contact_node.send(result);
        });
    } else {
        this.legion.generateMessage('JoinRequest', null, function (result) {
            result.N = bo.max - bo.overlay.peerCount();
            result.TTL = bo.initial_ttl;
            contact_node.send(result);
        });
    }
};

B2BOverlay.prototype.onJoinRequest = function (message, original, connection) {
    if (this.overlay.peers.contains(message.sender)) {
        message.TTL--;
        if (message.N > 0 && message.TTL > 0) {
            this.legion.messagingAPI.propagateToN(message);
        }
    } else {
        var connected = false;
        if (this.overlay.peerCount() < this.min) {
            connected = true;
        } else if (message.TTL == 0) {
            connected = true;
        } else if (this.overlay.peerCount() < this.max) {
            if (this.legion.bullyProtocol.amBullied() && Math.random() < (1 - this.RAND_VAL)) {
                connected = true;
            } else if (!this.legion.bullyProtocol.amBullied() && Math.random() < this.RAND_VAL) {
                connected = true;
            }
        }

        if (connected) {
            var bo = this;
            this.legion.generateMessage("JoinAnswer", null, function (result) {
                result.destination = message.sender;
                if (connection.isAlive())
                    connection.send(result);
                else {
                    bo.legion.messagingAPI.broadcastMessage(result);
                }
            });
        }

        if (connected)message.N--;
        message.TTL--;
        if (message.N > 0 && message.TTL > 0) {
            this.legion.messagingAPI.propagateToN(message);
        }
    }
};

B2BOverlay.prototype.onJoinAnswer = function (message, original, connection) {
    if (this.overlay.peers.contains(message.sender)) {
        //No op.
    } else {
        this.legion.connectionManager.connectPeer(message.sender);
    }
};

B2BOverlay.prototype.removeBestPeer = function () {
    var bestPeer = this.getBestPeer();
    if (!bestPeer) {
        bestPeer = this.overlay.getPeers(1);
        if (bestPeer.length() > 0) {
            bestPeer = bestPeer[0];
        }
    }
    bestPeer.close();
};

B2BOverlay.prototype.getBestPeer = function () {
    var best = null;
    var bestMeta = null;
    var peers = this.overlay.getPeers(this.overlay.peerCount());
    for (var i = 0; i < peers.length; i++) {
        if (!bestMeta) {
            bestMeta = peers[i].meta;
            best = peers[i];
        } else {
            if (this.isBetterMeta(peers[i].meta, bestMeta)) {
                bestMeta = peers[i].meta;
                best = peers[i];
            }
        }
    }
    return best;
};

B2BOverlay.prototype.isBetterMeta = function (m1, m2) {
    if (!m1) return false;
    if (!m2) return true;
    return m1.peers > m2.peers || m1.server < m2.server;
};

B2BOverlay.prototype.sendP2PMeta = function () {
    var bo = this;
    this.legion.generateMessage("P2PMeta", null, function (result) {
        result.meta = {
            server: !bo.legion.bullyProtocol.amBullied(),
            peers: bo.legion.overlay.peerCount()
        };
        bo.legion.messagingAPI.broadcastMessage(result, [bo.legion.connectionManager.serverConnection]);
    });
};

B2BOverlay.prototype.gotP2PMeta = function (message, original, connection) {
    connection.setMeta(message.meta);
};