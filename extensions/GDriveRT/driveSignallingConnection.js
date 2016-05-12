var B2B_MAP = "b2bmap";
function GDriveRTSignallingServerConnection(argument, legion) {
    console.error("a")
    this.argument = argument;
    this.legion = legion;
    this.lru = legion.lru;
    this.remoteID = "GDriveRTSigServ";

    var sc = this;
    this.onmessage = function (result, original) {
        var m = JSON.parse(result);
        if (m.content) {
            decompress(m.content, function (nv) {
                m.content = JSON.parse(nv);
                sc.legion.messagingAPI.onMessage(sc, m, result);
            });
        } else {
            sc.legion.messagingAPI.onMessage(sc, m, result);
        }
    };

    this.onclose = function () {
        this.legion.connectionManager.onCloseServer(this);
    };

    this.lru.realtimeUtils.load(this.lru.FileID_Overlay.replace('/', ''), function (doc) {
        sc.document = doc;
        sc.model = doc.getModel();
        if (sc.lru.legion.id == "TEMP_ID")
            sc.setID();
        sc.map = sc.document.getModel().getRoot().get(B2B_MAP);
        sc.legion.secure.setKey(sc.map.get("1"));
        //TODO: listener on map: if K:Key -> update key


        sc.initOverlay();

    }, function (model) {
        //console.info("load: B");
        var key = {};
        key.id = "1";
        key.key = forge.random.getBytesSync(16);
        key.iv = forge.random.getBytesSync(16);
        var map = model.createMap({
            B2B_MAP: B2B_MAP,
            "1": key
        });
        model.getRoot().set(B2B_MAP, map);

        sc.lru.createKeyFile(key);
        sc.lru.legion.secure.setKey(key);

    });
    //console.info("load: C");

}

GDriveRTSignallingServerConnection.prototype.close = function () {
    this.map.delete(this.lru.legion.id);
    this.send = function () {
        console.warn("Tried to send while shutting down.");
    };
    this.messageList.clear();
    this.document.close();
    this.messageList = null;
    this.document = null;
    this.map = null;
    this.onclose();
};

GDriveRTSignallingServerConnection.prototype.initOverlay = function () {
    var sc = this;
    console.info("initOverlay");
    this.map = this.document.getModel().getRoot().get(B2B_MAP);
    this.messageList = this.model.createList();
    this.model.getRoot().set(this.lru.legion.id, this.messageList);
    this.map.set(this.lru.legion.id, this.messageList);

    this.messageList.addEventListener(gapi.drive.realtime.EventType.VALUES_ADDED, function (evt) {
        //console.info(evt);
        var m_list = [];
        for (var i = 0; i < evt.values.length; i++) {
            m_list.push(sc.messageList.get(0));
            sc.messageList.remove(0);
        }
        for (var i = 0; i < m_list.length; i++) {
            (function (i) {
                decompress(m_list[i], function (result) {
                    sc.onmessage(result, m_list[i]);
                });
            })(i);
        }
    });
    this.messageList.addEventListener(gapi.drive.realtime.EventType.VALUES_REMOVED, function (evt) {
        ////console.error("List VALUES_REMOVED");
    });
    this.messageList.addEventListener(gapi.drive.realtime.EventType.VALUES_SET, function (evt) {
        console.error("List VALUES_SET");
    });

    this.legion.connectionManager.onOpenServer(this);
    console.info("initOverlay done");
};

GDriveRTSignallingServerConnection.prototype.setID = function () {
    function getMyIDFrom(collaborators) {
        for (var i = 0; i < collaborators.length; i++) {
            if (collaborators[i].isMe) {
                return {session: collaborators[i].sessionId, user: collaborators[i].userId};
            }
        }
    }

    var temp_id = getMyIDFrom(this.document.getCollaborators());
    var id = temp_id.session;
    console.log("Old ID: " + this.legion.id);
    this.legion.id = id;
    console.log("New ID: " + this.legion.id);
};

GDriveRTSignallingServerConnection.prototype.isAlive = function () {
    return (this.document != null && !this.document.isClosed);
};

GDriveRTSignallingServerConnection.prototype.send = function (message) {
    var sc = this;
    if (this.isAlive()) {
        if (message.N)message.N = 1;
        compress(JSON.stringify(message), function (result) {
            sc.collabBC(result, message.destination, message.sender, message.N);
        });
    }
};

GDriveRTSignallingServerConnection.prototype.collabBC = function (message, receiver, sender, N) {
    function idfrom(collab) {
        return collab.sessionId;
    }

    if (!this.document)return;

    var collaborators = this.document.getCollaborators();
    var peerMessageList;
    //try to send to receiver
    if (receiver) {
        for (var j = 0; j < collaborators.length; j++) {
            if (collaborators[j].isMe)continue;
            if (idfrom(collaborators[j]) != receiver)continue;
            peerMessageList = this.map.get(idfrom(collaborators[j]));
            if (peerMessageList) {
                console.log("Drive S Sending toR: " + idfrom(collaborators[j]));
                peerMessageList.push(message);
            }
            return;
        }
    }
    //failed, node somewhere in the network, send to all.
    var end = collaborators.length;
    if (N) {
        if (end > N) {
            end = N + 1; //1 because contains self.
        }
    }

    for (var i = 0; i < end; i++) {
        if (collaborators[i].isMe || collaborators[i].sessionId == sender)continue;
        if (this.legion.overlay.peers.contains(receiver))continue;
        var id = idfrom(collaborators[i]);
        peerMessageList = this.map.get(id);
        if (peerMessageList) {
            console.log("Drive S Sending to: " + id);
            peerMessageList.push(message);
        }
    }
};

GDriveRTSignallingServerConnection.prototype.isAlive = function () {
    return typeof this.document != "undefined";
};