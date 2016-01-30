function GDriveRTObjectsServerConnection(argument, objectStore, legion) {
    this.argument = argument;
    this.objectStore = objectStore;
    this.legion = legion;
    this.lru = legion.lru;
    this.remoteID = this.lru.FileID_Objects;

    this.onclose = function () {
        sc.legion.connectionManager.onCloseServer(sc);
    };

    this.document = null;
    this.model = null;
    var sc = this;
    if (this.lru.ready)
        this.startup();
    else {
        setTimeout(function () {
            sc.startup()
        }, 200);
    }
}

GDriveRTObjectsServerConnection.prototype.startup = function () {
    var sc = this;
    if (this.lru.ready) {
        this.lru.realtimeUtils.load(this.lru.FileID_Objects.replace('/', ''), function (doc) {
            sc.document = doc;
            sc.model = doc.getModel();
            sc.legion.connectionManager.onOpenServer(sc);

        }, function () {
            console.error("File init should have been done!");
        });
    } else {
        setTimeout(function () {
            sc.startup()
        }, 200);
    }
};

GDriveRTObjectsServerConnection.prototype.close = function () {
    this.document.close();
    this.document = null;
    this.model = null;
    this.onclose();
};

/**
 * Receives compressed message!
 * @param message
 */
GDriveRTObjectsServerConnection.prototype.send = function (message) {
    var sc = this;
    var m = JSON.parse(message);
    try {
        decompress(m.content, function (result) {
            m.content = JSON.parse(result);
            sc.doSend(m);
        });
    }
    catch (e) {
        console.error(event);
        console.error(m);
        console.error(original);
        console.error(e);
    }
};

GDriveRTObjectsServerConnection.prototype.doSend = function (message) {
    switch (message.type) {
        case (this.objectStore.handlers.peerSync.type):
            this.onSendPeerSync();
            return;
        case (this.objectStore.handlers.peerSyncAnswer.type):
            this.onSendPeerSyncAnswer();
            return;
        case (this.objectStore.handlers.gotContentFromNetwork.type):
            this.onServerContentFromNetwork(message);
            return;
        case (this.objectStore.handlers.version_vector_propagation.type):
            console.error("This should never be called.");
    }
    console.error(message);
};

/**
 * Skip the sync part. Apply remote ops to crdts directly and add crdt changes to remote.
 * @param message
 */
GDriveRTObjectsServerConnection.prototype.onSendPeerSync = function (message) {
    var dc = this;
    var rootMap = this.document.getModel().getRoot().get('RootMap');
    var rootMapOps = rootMap.asArray();
    var localRootMap = this.objectStore.get("RootMap", CRDT_LIB.OP_ORMap.type, true);

    localRootMap.operationsFromNetwork(rootMapOps, this);

    var vvDiff = this.objectStore.versionVectorDiff(localRootMap.getVersionVector(), []);
    var operations = localRootMap.getOperations(vvDiff.vv2.missing);

    for (var i = 0; i < operations.length; i++) {
        if (!this.driveListHasOP(rootMap, operations[i])) {
            rootMap.insert(rootMap.length, operations[i]);
        }
    }

    var objectKeys = localRootMap.keys();
    for (var i = 0; i < objectKeys.length; i++) {
        var objectKey = objectKeys[i];
        var objectList = this.document.getModel().getRoot().get(objectKey);
        console.log("Object: ", objectKey);
        console.log("ObjectList: ", objectList.asArray());
        console.log("Object Type: ", localRootMap.get(objectKey)[0]);

        objectList.addEventListener(gapi.drive.realtime.EventType.VALUES_ADDED, function (evt) {
            var m_list = [];
            for (var i = 0; i < evt.values.length; i++) {
                m_list.push(evt.values[i]);
            }
            dc.operations(objectKey, m_list)
        });

        var objectListAsArray = objectList.asArray();
        var localObject;
        switch (localRootMap.get(objectKey)[0]) {
            case "Map":
                console.log("Create map.");
                localObject = this.objectStore.get(objectKey, CRDT_LIB.OP_ORMap.type, true);
                break;
            case "List":
                console.log("Create list.");
                localObject = this.objectStore.get(objectKey, CRDT_LIB.OP_List.type, true);
                break;
        }
        localObject.operationsFromNetwork(objectListAsArray, this);

        var vvDiff = this.objectStore.versionVectorDiff(localObject.getVersionVector(), []);
        var operations = localObject.getOperations(vvDiff.vv2.missing);

        for (var i = 0; i < operations.length; i++) {
            if (!this.driveListHasOP(objectList, operations[i])) {
                objectList.insert(objectList.length, operations[i]);
            }
        }
    }

    var messageContent = {states: [], missing_ops: []};
    var os = this;
    this.legion.generateMessage(this.objectStore.handlers.peerSyncAnswer.type, messageContent, function (result) {
        result.content = messageContent;
        os.objectStore.onMessageFromServer(result, result, this);
    });
    this.objectStore.objectServer.isSynced = true;
};

GDriveRTObjectsServerConnection.prototype.operations = function (objectKey, operations) {
    var crdt = this.objectStore.crdts.get(objectKey);
    crdt.operationsFromNetwork(operations, this, null);
};

GDriveRTObjectsServerConnection.prototype.driveListHasOP = function (list, op) {
    for (var i = 0; i < list.length; i++) {
        if (op.opID == list.get(i).opID) {
            if (op.clientID == list.get(i).clientID) {
                return true;
            }
        }
    }
    return false;
};

GDriveRTObjectsServerConnection.prototype.onSendPeerSyncAnswer = function (message) {
    console.error("Won't be called.");
};

GDriveRTObjectsServerConnection.prototype.onServerContentFromNetwork = function (message) {
    var objectID = message.content.msg.objectID;
    if (!objectID)
        console.error(message)
    var objectList = this.document.getModel().getRoot().get(objectID);
    if (!this.driveListHasOP(objectList, message.content.msg)) {
        objectList.insert(objectList.length, message.content.msg);
    }
};
