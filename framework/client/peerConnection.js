function PeerConnection(remoteID, legion) {
    if (detailedDebug) {
        console.log("PC from " + legion.id + " to " + remoteID);
    }
    this.remoteID = remoteID;
    this.legion = legion;
    this.peer = new RTCPeerConnection(servers, pcConstraint);
    this.channel = null;
}

PeerConnection.prototype.setChannelHandlers = function () {
    var pc = this;
    this.channel.onmessage = function (event) {
        var m = JSON.parse(event.data);
        var original = JSON.parse(event.data);
        if (m.content) {
            decompress(m.content, function (result) {
                m.content = JSON.parse(result);
                pc.legion.messagingAPI.onMessage(pc, m, original);
            });
        } else {
            pc.legion.messagingAPI.onMessage(pc, m, original);
        }
    };
    this.channel.onopen = function (event) {
        pc.legion.connectionManager.onOpenClient(pc);
    };
    this.channel.onclose = function (event) {
        pc.legion.connectionManager.onCloseClient(pc);
    };
};

PeerConnection.prototype.returnOffer = function (offer) {
    if (detailedDebug)console.log(offer);
    this.peer.setRemoteDescription(new RTCSessionDescription(offer));
};

PeerConnection.prototype.return_ice = function (candidate) {
    if (detailedDebug)console.log(candidate);
    this.peer.addIceCandidate(new RTCIceCandidate(candidate),
        function () {
            /*success*/
        },
        function (error) {
            console.error("onAddIceCandidateError", error);
        }
    );
};

PeerConnection.prototype.onicecandidate = function (event) {
    if (event.candidate) {
        this.legion.connectionManager.sendICE(event.candidate, this);
    }
};

PeerConnection.prototype.startLocal = function () {
    if (debug)console.log("start local: " + this.remoteID);
    var pc = this;
    this.channel = this.peer.createDataChannel('sendDataChannel', dataConstraint);

    this.setChannelHandlers();

    this.peer.onicecandidate = function (event) {
        pc.onicecandidate(event);
    };

    this.peer.createOffer(function (offer) {
            pc.peer.setLocalDescription(offer);
            pc.legion.connectionManager.sendStartOffer(offer, pc);
        }, function (error) {
            console.error("onCreateSessionDescriptionError", error);
            pc.onclose()
        }
    );
};

PeerConnection.prototype.startRemote = function (offer) {
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
        pc.legion.connectionManager.sendReturnOffer(offer, pc);
    }, function (error) {
        console.error("onCreateSessionDescriptionError", error);
        pc.onclose()
    });
};

PeerConnection.prototype.send = function (message) {
    if (typeof message == "object") {
        message = JSON.stringify(message);
    }
    if (this.channel && this.channel.readyState == "open")
        this.channel.send(message);
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

