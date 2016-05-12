function GDriveRTObjectsServerConnection(argument, objectStore, legion) {
    this.argument = argument;
    this.objectStore = objectStore;
    this.legion = legion;
    this.lru = legion.lru;
    this.remoteID = this.lru.FileID_Objects;

    if (!this.lru.ready)
        return;

    this.onclose = function () {
        sc.legion.connectionManager.onCloseServer(sc);
    };

    this.document = null;
    this.model = null;
    var sc = this;
    this.startup();
}

GDriveRTObjectsServerConnection.prototype.startup = function () {
    var sc = this;
    this.lru.realtimeUtils.load(this.lru.FileID_Objects.replace('/', ''), function (doc) {
        sc.document = doc;
        sc.model = doc.getModel();
        sc.legion.connectionManager.onOpenServer(sc);
    }, function () {
        console.error("File init should have been done!");
    });

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
            console.warn("This should never be called.");
    }
    console.warn(message);
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

    var vvDiff = localRootMap.versionVectorDiff(localRootMap.getVersionVector(), []);
    var operations = localRootMap.getOperations(vvDiff.vv2.missing);

    for (var i = 0; i < operations.length; i++) {
        if (!this.driveListHasOP(rootMap, operations[i])) {
            rootMap.insert(rootMap.length, operations[i]);
        }
    }

    var objectKeys = localRootMap.keys();
    for (var i = 0; i < objectKeys.length; i++) {
        var objectKey = objectKeys[i];
        if (this.document.getModel().getRoot().get(objectKey)) {
            var t = this;
            (function (objectKey) {
                var objectList = t.document.getModel().getRoot().get(objectKey);
                if (objectList) {
                    console.log("Object: ", objectKey);
                    console.log("ObjectList: ", objectList.asArray());
                    console.log("Object Type: ", localRootMap.get(objectKey)[0]);

                    objectList.addEventListener(gapi.drive.realtime.EventType.VALUES_ADDED, function (evt) {
                        var m_list = [];
                        for (var j = 0; j < evt.values.length; j++) {
                            m_list.push(evt.values[j]);
                        }
                        dc.operations(objectKey, m_list)
                    });

                    var objectListAsArray = objectList.asArray();
                    var localObject;
                    switch (localRootMap.get(objectKey)[0]) {
                        case "Map":
                            console.log("Create map.");
                            localObject = t.objectStore.get(objectKey, CRDT_LIB.OP_ORMap.type, true);
                            break;
                        case "List":
                            console.log("Create list.");
                            localObject = t.objectStore.get(objectKey, CRDT_LIB.OP_Treedoc.type, true);
                            break;
                    }
                    localObject.operationsFromNetwork(objectListAsArray, t);

                    var vvDiff = localObject.versionVectorDiff(localObject.getVersionVector(), []);
                    var operations = localObject.getOperations(vvDiff.vv2.missing);

                    for (var j = 0; j < operations.length; j++) {
                        if (!t.driveListHasOP(objectList, operations[j])) {
                            objectList.insert(objectList.length, operations[j]);
                        }
                    }
                }
            })(objectKey);
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
    var prevSize = list.length;
    for (var i = list.length; i > 0; i--) {
        if (op.opID == list.get(i - 1).opID) {
            if (op.clientID == list.get(i - 1).clientID) {
                return true;
            }
        }
    }
    if (list.length > prevSize) {
        console.warn("This shouldn't happen.");
        //Solve it anyway.
        for (var i = list.length; i > prevSize; i--) {
            if (op.opID == list.get(i - 1).opID) {
                if (op.clientID == list.get(i - 1).clientID) {
                    return true;
                }
            }
        }
    }
    return false;
};

GDriveRTObjectsServerConnection.prototype.onSendPeerSyncAnswer = function (message) {
    console.error("Won't be called.");
};

GDriveRTObjectsServerConnection.prototype.onServerContentFromNetwork = function (message) {
    var objectID = message.content.objectID;
    if (!objectID)
        console.error(message)
    var objectList = this.document.getModel().getRoot().get(objectID);
    if (!this.driveListHasOP(objectList, message.content.msg)) {
        objectList.insert(objectList.length, message.content.msg);
    }
};
