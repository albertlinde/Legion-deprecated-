var DEFAULT_PEER_INIT_TIMEOUT = 7 * 1000;

function PeerConnection(remoteID, legion) {
    if (detailedDebug) {
        console.log("PC from " + legion.id + " to " + remoteID);
    }
    this.remoteID = remoteID;
    this.legion = legion;
    this.peer = new RTCPeerConnection(servers, pcConstraint);
    this.channel = null;

    var pc = this;
    this.init_timeout = setTimeout(function () {
        pc.onInitTimeout()
    }, DEFAULT_PEER_INIT_TIMEOUT);

    this.unique = null;
}

PeerConnection.prototype.onInitTimeout = function () {
    console.warn("Peer " + this.legion.id + " connection timeout before getting offer from " + this.remoteID + ".");
    this.cancelAll(true);
};

PeerConnection.prototype.setChannelHandlers = function () {
    var pc = this;
    this.channel.onmessage = function (event) {
        var m = JSON.parse(event.data);
        console.log("Got " + m.type + " from " + pc.remoteID + " s: " + m.sender);
        var original = JSON.parse(event.data);
        if (m.content) {
            try {
                decompress(m.content, function (result) {
                    m.content = JSON.parse(result);
                    pc.legion.messagingAPI.onMessage(pc, m, original);
                });
            }
            catch (e) {
                console.error(event);
                console.error(m);
                console.error(original);
                console.error(e);
            }
        } else {
            decompress("5d00000100040000000000000000331849b7e4c02e1ffffac8a000", function (result) {
                pc.legion.messagingAPI.onMessage(pc, m, original);
            });
        }
    };
    this.channel.onopen = function (event) {
        pc.legion.connectionManager.onOpenClient(pc);
    };
    this.channel.onclose = function (event) {
        pc.legion.connectionManager.onCloseClient(pc);
    };
};

/**
 * This method is called to remove a concurrently created and started PeerConnection.
 * Used by timeout on getting offers with argument true.
 */
PeerConnection.prototype.cancelAll = function (notDuplicate) {
    var pc = this;
    if (!notDuplicate)
        if (this.channel)
            this.channel.onclose = function () {
                console.log("Forced a channel close for duplicate PeerConnection.", pc.legion.id, pc.remoteID);
            };
    this.channel = null;
    this.peer.close();
    clearTimeout(this.init_timeout);
    this.peer = null;
    this.legion.connectionManager.onCloseClient(this);
};

PeerConnection.prototype.returnOffer = function (offer) {
    clearTimeout(this.init_timeout);
    if (detailedDebug)console.log(offer);
    this.peer.setRemoteDescription(new RTCSessionDescription(offer));
};

PeerConnection.prototype.return_ice = function (candidate) {
    clearTimeout(this.init_timeout);
    if (detailedDebug)console.log(candidate);
    var pc = this;
    this.peer.addIceCandidate(new RTCIceCandidate(candidate),
        function () {
            /*success*/
        },
        function (error) {
            //This occurs when an ICE candidate is received for a previous offer.
            //This means that concurrently two peers tried to start, and one won.
            //Messages that were in route can't magically be removed.
            //i.e., dont worry if connection are still made.
            console.warn("onAddIceCandidateError", pc.legion.id, pc.remoteID, error, candidate);
        }
    );
};

PeerConnection.prototype.onicecandidate = function (event) {
    if (event.candidate) {
        this.legion.connectionManager.sendICE(event.candidate, this.unique, this);
    }
};

/**
 *
 */
PeerConnection.prototype.close = function () {
    this.cancelAll(true);
};

PeerConnection.prototype.startLocal = function () {
    if (debug)console.log("start local: " + this.remoteID);
    var pc = this;
    this.channel = this.peer.createDataChannel('sendDataChannel', dataConstraint);


    this.unique = this.legion.randInt();
    this.setChannelHandlers();

    this.peer.onicecandidate = function (event) {
        pc.onicecandidate(event);
    };

    this.peer.createOffer(function (offer) {
            pc.peer.setLocalDescription(offer);
            pc.legion.connectionManager.sendStartOffer(offer, pc.unique, pc);
        }, function (error) {
            console.error("onCreateSessionDescriptionError", error);
            pc.onclose()
        }
    );
};

PeerConnection.prototype.startRemote = function (offer, unique) {
    this.unique = unique;
    if (detailedDebug)console.log(offer);
    if (debug)console.log("start remote: " + this.remoteID);
    this.peer.setRemoteDescription(new RTCSessionDescription(offer));
    var pc = this;
    this.peer.ondatachannel =
        function (event) {
            pc.channel = event.channel;
            pc.setChannelHandlers();
        };

    this.peer.onicecandidate = function (event) {
        pc.onicecandidate(event);
    };

    this.peer.createAnswer(function (offer) {
        pc.peer.setLocalDescription(offer);
        pc.legion.connectionManager.sendReturnOffer(offer, pc.unique, pc);
    }, function (error) {
        console.error("onCreateSessionDescriptionError", error);
        pc.onclose()
    });
};

PeerConnection.prototype.isAlive = function () {
    return this.channel && this.channel.readyState == "open";
};

PeerConnection.prototype.setMeta = function (m) {
    this.meta = m;
};

PeerConnection.prototype.getMeta = function () {
    return this.meta;
};

PeerConnection.prototype.send = function (message) {
    if (typeof message == "object") {
        message = JSON.stringify(message);
    }
    if (this.channel && this.channel.readyState == "open") {
        this.channel.send(message);
        console.log("Sent " + JSON.parse(message).type + " to " + this.remoteID + " s: " + JSON.parse(message).sender);
    } else {
        console.warn("Peer has no open channel.")
    }
};

/**
 * WebRTC parameters.
 */
{
    var servers = {
        iceServers: [{"url": "stun:stun.l.google.com:19302"}]
    };
    var pcConstraint = {
        optional: [{
            RtpDataChannels: false
        }]
    };
    var dataConstraint = null;

}

