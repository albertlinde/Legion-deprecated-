var B2B_MAP = "b2bmap";
function GDriveRTSignallingServerConnection(argument, legion) {
    this.argument = argument;
    this.legion = legion;
    this.lru = legion.lru;

    this.onmessage = function (event) {
        decompress(event, function (result) {
            var m = JSON.parse(result);
            manager.onMessageServer("overlayDocument", m.group, m, event.length, result.length);
        });
    };

    this.onclose = function () {
        //console.log("CLOSE "+manager.id+ " to Server: overlayDocument. Objects:" + this.objectsFile);
        manager.onCloseServer("overlayDocument", group);
    };


    var sc = this;
    this.lru.realtimeUtils.load(this.lru.FileID_Overlay.replace('/', ''), function (doc) {
        sc.document = doc;
        sc.model = doc.getModel();
        if (sc.id == "TEMP_ID")
            sc.setID();
        sc.initOverlay();

    }, function (model) {
        //console.info("load: B");
        var map = model.createMap({
            B2B_MAP: B2B_MAP
        });
        model.getRoot().set(B2B_MAP, map);
    });
    //console.info("load: C");

    this.onObjects = true;
}

GDriveRTSignallingServerConnection.prototype.close = function () {
    this.messageList.clear();
    this.document.close();
    this.messageList = null;
    this.document = null;
    this.map = null;
    this.onclose();
};

GDriveRTSignallingServerConnection.prototype.initOverlay = function () {
    var sc = this;
    //console.info("initOverlay");
    this.map = this.document.getModel().getRoot().get(B2B_MAP);
    this.messageList = this.model.createList();
    this.model.getRoot().set(this.manager.id, this.messageList);
    this.map.set(this.manager.id, this.messageList);
    //console.info("initOverlay setupList done");

    this.messageList.addEventListener(gapi.drive.realtime.EventType.VALUES_ADDED, function (evt) {
        //console.info("Overlay VALUE_ADDED");
        for (var i = 0; i < evt.values.length; i++) {
            sc.onmessage(sc.messageList.get(0));
            sc.messageList.remove(0);
        }
    });
    this.messageList.addEventListener(gapi.drive.realtime.EventType.VALUES_REMOVED, function (evt) {
        ////console.error("List VALUES_REMOVED");
    });
    this.messageList.addEventListener(gapi.drive.realtime.EventType.VALUES_SET, function (evt) {
        //console.error("List VALUES_SET");
    });

    this.manager.onOpenServer('overlayDocument', this.group, this);

    //console.info("initOverlay done");
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
    var id = temp_id.user + '-' + temp_id.session;
    console.log("Old ID: " + this.legion.id);
    this.legion.id = id;
    console.log("New ID: " + this.legion.id);
};

GDriveRTSignallingServerConnection.prototype.isAlive = function () {
    return (this.document != null && !this.document.isClosed);
};

GDriveRTSignallingServerConnection.prototype.send = function (message) {
    switch (message.type) {
        //TODO: overlay messages
        case 'OfferAsAnswer':
        case 'OfferReturn':
        case 'ICE':
            var sc = this;
            if (this.isAlive()) {
                compress(message, function (result) {
                    sc.collabBC(result, message.destination);
                });
            }
            break;

    }
};


GDriveRTSignallingServerConnection.prototype.collabBC = function (message, receiver) {
    function idfrom(collab) {
        return collab.userId + '-' + collab.sessionId;
    }

    var collaborators = this.document.getCollaborators();
    var peerMessageList;
    //try to send to receiver
    if (receiver) {
        for (var j = 0; j < collaborators.length; j++) {
            if (collaborators[j].isMe)continue;
            if (idfrom(collaborators[j]) != receiver)continue;
            console.log("Sending toR: " + idfrom(collaborators[j]));
            peerMessageList = this.map.get(idfrom(collaborators[j]));
            if (peerMessageList)
                peerMessageList.push(message);
            return;
        }
    }
    //failed, node somewhere in the network, send to all.
    for (var i = 0; i < collaborators.length; i++) {
        if (collaborators[i].isMe)continue;
        console.log("Sending to: " + idfrom(collaborators[i]));
        peerMessageList = this.map.get(idfrom(collaborators[i]));
        if (peerMessageList)
            peerMessageList.push(message);
    }
};

