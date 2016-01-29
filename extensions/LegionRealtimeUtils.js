var debug = false;
var objectsDebug = false;
var detailedDebug = false;
var bullyLog = true;

function LegionRealtimeUtils(realtimeUtils) {
    //NOTICE: current implementation does not allow for objects in objects.
    this.realtimeUtils = realtimeUtils;

    this.legion = null;
    this.objectStore = null;

    this.merge_to_legacy = true;
    this.signalling_on_legacy = false;
    this.persitence_on_legacy = false;

    /**
     * Used by all to obtains other files.
     * @type {String, null}
     */
    this.FileID_Original = null;
    /**
     * Used by all to join overlays.
     * @type {String, null}
     */
    this.FileID_Overlay = null;
    /**
     * Used by some (bullies) to ensure persistence.
     * @type {String, null}
     */
    this.FileID_Objects = null;

    this.FileID_Merge = null;

    /**
     * Keeps key-value in the form crdtID-crdtType.
     * @type {CRDT}
     */
    this.map = null;

    this.constants = {
        FileID_Overlay: "FileID_Overlay",
        FileID_Objects: "FileID_Objects",
        FileID_Merge: "FileID_Merge",
        FileID_MainBully: "FileID_MainBully",
        objectsMap: "RootMap",
        WAIT_ON_MAP_INIT: 3 * 1000
    };


    this.mergeUtils = new MergeUtils(this);
    this.revisions = new ALMap();
}
/**
 *
 * @param fileID {String}
 * @param onLoad {Function}
 * @param onInit {Function}
 */
LegionRealtimeUtils.prototype.load = function (fileID, onLoad, onInit) {
    this.FileID_Original = fileID;

    var lru = this;
    if (!gapi.client.drive)
        gapi.client.load('drive', 'v2', function () {
            lru.load(fileID, onLoad, onInit);
        });
    else {
        getPropertyFromFile(fileID, lru.constants.FileID_Overlay, function (property) {
            if (!property) {
                lru.realtimeUtils.load(fileID, function (document) {
                    document.close();
                    lru.realtimeUtils.createRealtimeFile(lru.constants.FileID_Overlay, function (createResponse) {
                        addPropertyToFile(fileID, lru.constants.FileID_Overlay, createResponse.id, function () {
                            lru.load(fileID, onLoad, onInit);
                        });
                    });
                }, function (arg) {
                    //console.log("File init: " + fileID);
                    onInit(arg);
                });
            } else {
                lru.FileID_Overlay = property;
                lru.gotOverlayFile(onLoad);
            }
        });
    }
};

/**
 *
 * @param onLoad {Function}
 */
LegionRealtimeUtils.prototype.gotOverlayFile = function (onLoad) {
    var signalling;
    var signallingServer;
    var clientID = ("" + Math.random()).substr(2, 4);

    var persistence;
    var persistenceServer;
    if (!this.persitence_on_legacy) {
        persistence = ObjectServerConnection;
        persistenceServer = {ip: "localhost", port: 8004};
    } else {
        persistence = GDriveRTObjectsServerConnection;
        persistenceServer = {};
    }

    if (!this.signalling_on_legacy) {
        signalling = ServerConnection;
        signallingServer = {ip: "localhost", port: 8002};
    } else {
        signalling = GDriveRTSignallingServerConnection;
        signallingServer = {};
        clientID = "TEMP_ID";
    }

    var options = {
        clientID: clientID,
        overlayProtocol: SimpleOverlay,
        messagingProtocol: FloodMessaging,
        objectOptions: {
            serverInterval: 5000,
            peerInterval: 2000
        },
        bullyProtocol: {
            type: SimpleBully,
            options: {
                bullyMustHaveInterval: 15 * 1000,
                bullySendInterval: 7 * 1000,
                bullyStartTime: 2 * 1000
            }
        },
        signallingConnection: {
            type: signalling,
            server: signallingServer
        },
        objectServerConnection: {
            type: persistence,
            server: persistenceServer
        }
    };

    this.legion = new Legion(options);
    this.legion.lru = this;
    this.legion.join();


    this.objectStore = this.legion.getObjectStore();

    this.objectStore.defineCRDT(CRDT_LIB.OP_List);
    this.objectStore.defineCRDT(CRDT_LIB.OP_ORMap);

    this.map = this.objectStore.get(this.constants.objectsMap, CRDT_LIB.OP_ORMap.type);


    this.startObjectsProtocol(onLoad);
};

/**
 *
 * @param onLoad {Function}
 */
LegionRealtimeUtils.prototype.gotMap = function (onLoad) {
    var lru = this;

    var keys = this.map.keys();
    if (keys.length == 0) {
        console.log("Waiting on map init.");
        setTimeout(function () {
            lru.gotMap(onLoad);
        }, this.constants.WAIT_ON_MAP_INIT);
    } else {
        var objects = [];
        for (var i = 0; i < keys.length; i++) {
            var type = this.map.get(keys[i])[0];
            switch (type) {
                case "Map":
                    console.info("Object init: " + type + " ID: " + keys[i]);
                    objects[keys[i]] = this.objectStore.get(keys[i], CRDT_LIB.OP_ORMap.type);
                    break;
                case "List":
                    console.info("Object init: " + type + " ID: " + keys[i]);
                    objects[keys[i]] = this.objectStore.get(keys[i], CRDT_LIB.OP_List.type);
                    break;
                case "String":
                    console.error("Not implemented: strings");
                    break;
            }
        }
        this.interfaceHandler = new GapiInterfaceHandler(objects, this.map);
        onLoad(this.interfaceHandler);
    }
};

/**
 *
 */
LegionRealtimeUtils.prototype.startObjectsProtocol = function (onLoad) {
    var rootMap = this.map;
    var lru = this;
    var keys = rootMap.keys();
    if (keys.length == 0) {
        console.log("Got an empty RootMap.");
        if (this.FileID_Objects) {
            setTimeout(function () {
                lru.startObjectsProtocol(onLoad);
            }, lru.constants.WAIT_ON_MAP_INIT);
        } else {
            getPropertyFromFile(lru.FileID_Original, lru.constants.FileID_Objects, function (property) {
                if (!property) {
                    lru.checkIfMainBully(function (result) {
                        if (result) {
                            lru.initRootMap(function () {
                                lru.startObjectsProtocol(onLoad);
                            });
                        } else {
                            console.log("I am not the main bully, waiting.");
                            setTimeout(function () {
                                lru.startObjectsProtocol(onLoad);
                            }, lru.constants.WAIT_ON_MAP_INIT);
                        }
                    });
                } else {
                    lru.FileID_Objects = property;
                    lru.startObjectsProtocol(onLoad);
                }
            });
        }
    } else {
        console.log("Got a filled RootMap.");
        this.gotMap(onLoad);
        if (lru.merge_to_legacy) {
            setInterval(function () {
                lru.checkIfMainBully(function (result) {
                    if (result) {
                        console.log("Try to write to Merge and Original file.");
                        lru.mergeFiles();
                    } else {
                        //console.log("Won't to write to Merge and Original file.");
                    }
                });
            }, 10 * 1000);
        }
    }
};

/**
 *
 */
LegionRealtimeUtils.prototype.mergeFiles = function () {
    if (this.FileID_Merge) {
        this.mergeUtils.mergeFiles();
    } else {
        var lru = this;
        getPropertyFromFile(this.FileID_Original, this.constants.FileID_Merge, function (property) {
            if (!property) {
                console.error("FileID_Merge does not exists!");
            } else {
                lru.FileID_Merge = property;
                lru.mergeFiles();
            }
        });
    }
};

/**
 *
 * @param callback
 */
LegionRealtimeUtils.prototype.initRootMap = function (callback) {
    console.log("initRootMap start");
    var objects = [];
    var rootMap = this.map;
    var objectStore = this.objectStore;

    function initObject(object, ref) {
        if (object.id) {
            console.log("initObject: " + object.id + " - " + object.type);
            if (object.type == "Map") {
                console.info("Init Map with id: " + object.id);

                rootMap.set(object.id, "Map");
                var map = objectStore.get(object.id, CRDT_LIB.OP_ORMap.type);
                objects[object.id] = map;

                var keys = Object.keys(object.value);
                for (var i = 0; i < keys.length; i++) {
                    var currKey = keys[i];
                    var currObject = object.value[currKey];
                    initObject(currObject, ref + "|" + object.id);
                }
            }
            if (object.type == "List") {
                console.info("Init List with id: " + object.id);

                rootMap.set(object.id, "List");
                objects[object.id] = objectStore.get(object.id, CRDT_LIB.OP_List.type);

                for (var j = 0; j < object.value.length; j++) {
                    initObject(object.value[j], ref + "|" + object.id);
                }
            }
            if (object.type == "EditableString") {
                console.error("Not implemented: EditableString");
            }
        }
        if (object.ref) {
            console.info("Ref id: " + object.ref + " in: " + ref);
        }
        if (object.json) {
            console.info("Json in: " + ref);
        }
    }

    function fillObject(object, ref) {
        if (object.id) {
            if (object.type == "Map") {
                rootMap.set(object.id, "Map");
                console.info("Fill Map with id: " + object.id);
                var keys = Object.keys(object.value);
                for (var i = 0; i < keys.length; i++) {
                    var currKey = keys[i];
                    var currObject = object.value[currKey];
                    //console.log(currObject);
                    //console.log(objects[object.id]);

                    if (currObject.id) {
                        //console.info("Set: " + currKey + " to " + objects[currObject.id]);
                        objects[object.id].set(currKey, objects[currObject.id]);
                    } else if (currObject.ref) {
                        //console.info("Set: " + currKey + " to " + objects[currObject.ref]);
                        objects[object.id].set(currKey, objects[currObject.ref]);
                    } else if (currObject.json) {
                        //console.info("Set: " + currKey + " to " + currObject.json);
                        objects[object.id].set(currKey, currObject.json);
                    }
                    //console.log(objects[object.id].items());

                    fillObject(currObject, ref + "|" + object.id);
                }
            }
            if (object.type == "List") {
                rootMap.set(object.id, "List");
                console.info("Fill List with id: " + object.id);
                for (var j = 0; j < object.value.length; j++) {
                    var currObjectL = object.value[j];
                    if (currObjectL.id) {
                        objects[object.id].insert(j, objects[currObjectL.id]);
                    } else if (currObjectL.ref) {
                        objects[object.id].insert(j, objects[currObjectL.ref]);
                    } else if (currObjectL.json) {
                        objects[object.id].insert(j, currObjectL.json);
                    }

                    fillObject(object.value[j], ref + "|" + object.id);
                }
            }
            if (object.type == "EditableString") {
                console.error("Not implemented: EditableString");
            }
        }
        if (object.ref) {
            //should do nothing.
            console.info("Ref id: " + object.ref + " in: " + ref);
        }
        if (object.json) {
            //should do nothing.
            console.info("Json in: " + ref);
        }
    }

    getCurrentRevision(this.FileID_Original, function (revision) {
        console.log("Got revision: " + revision.revision);
        lru.revisions.set(parseInt(revision.revision), revision);

        var currRootKey;
        var currRootObject;

        var rootKeys = Object.keys(revision.result.data.value);
        console.log("rootKeys: " + rootKeys);
        for (var i = 0; i < rootKeys.length; i++) {
            currRootKey = rootKeys[i];
            currRootObject = revision.result.data.value[currRootKey];
            initObject(currRootObject, "root");
        }

        for (var j = 0; j < rootKeys.length; j++) {
            currRootKey = rootKeys[j];
            currRootObject = revision.result.data.value[currRootKey];
            if (currRootObject.id)
                rootMap.set(currRootKey, currRootObject.id);
            fillObject(currRootObject, "root");
        }

        console.log("createObjectsFile");
        lru.createObjectsFile(function () {
            console.log("createMergeFile");
            lru.createMergeFile(function () {
                console.log("initRootMap end");
                callback();
            });
        });
    });
};

/**
 *
 * @param callback
 */
LegionRealtimeUtils.prototype.checkIfMainBully = function (callback) {
    if (!this.mbp) {
        this.mbp = new MainBullyProtocol(this);
    }
    this.mbp.checkIfMainBully(callback);
};

/**
 *
 * @param callback
 */
LegionRealtimeUtils.prototype.createMergeFile = function (callback) {
    console.log("createMergeFile start");
    if (this.FileID_Merge) {
        realtimeUtils.load(this.FileID_Merge.replace('/', ''),
            function (doc) {
                console.log("createMergeFile end");
                doc.close();
                callback();
            }, function (model) {

                var keys = lru.revisions.keys();
                var maxRevN = keys.sort()[keys.length - 1];
                var maxRevV = lru.revisions.get(maxRevN);
                var local = lru.mergeUtils.getLocalValue();

                var map = model.createMap({
                    FileID_Original: lru.FileID_Original,
                    gapi: {num: maxRevN, val: maxRevV},
                    b2b: {val: local}
                });
                model.getRoot().set('b2b_map', map);
            });
    } else {
        getPropertyFromFile(lru.FileID_Original, lru.constants.FileID_Merge, function (property) {
            if (!property) {
                lru.realtimeUtils.createRealtimeFile(lru.constants.FileID_Merge, function (createResponse) {
                    addPropertyToFile(lru.FileID_Original, lru.constants.FileID_Merge, createResponse.id, function () {
                        lru.createMergeFile(callback);
                        console.log("createMergeFile: " + createResponse.id);
                    });
                });
            } else {
                lru.FileID_Merge = property;
                lru.createMergeFile(callback);
            }
        });
    }
};

/**
 *
 * @param callback
 */
LegionRealtimeUtils.prototype.createObjectsFile = function (callback) {
    console.log("createObjectsFile start");

    var rootMap = this.map;
    var lru = this;
    if (this.FileID_Objects) {
        this.realtimeUtils.load(this.FileID_Objects.replace('/', ''),
            function (doc) {
                console.log("createObjectsFile end");
                doc.close();
                callback();
            }, function (model) {
                var map = model.createMap({
                    FileID_Original: lru.FileID_Original,
                    RootMap: CRDT_LIB.OP_ORMap.type
                });
                var list = model.createList();
                model.getRoot().set("RootMap", list);

                var vv = rootMap.getVersionVector();
                var vvDiff = lru.objectStore.versionVectorDiff(vv, []);
                var ops = rootMap.getOperations(vvDiff.vv2.missing);

                for (var i = 0; i < ops.length; i++) {
                    list.insert(i, ops[i]);
                }

                var keys = rootMap.keys();
                for (var i = 0; i < keys.length; i++) {
                    var key = keys[i];
                    var crdt = lru.objectStore.getCRDT(key);

                    map.set(key, crdt.crdt.type);
                    var list = model.createList();
                    model.getRoot().set(key, list);

                    if (crdt.crdt.propagation == CRDT.STATE_BASED) {
                        list.insert(0, crdt.toJSONString(crdt.getState()));
                    } else if (crdt.crdt.propagation == CRDT.OP_BASED) {
                        var vv = crdt.getVersionVector();
                        var vvDiff = lru.objectStore.versionVectorDiff(vv, []);
                        var ops = crdt.getOperations(vvDiff.vv2.missing);
                        for (var i = 0; i < ops.length; i++) {
                            list.insert(i, ops[i]);
                        }
                    }
                }
                model.getRoot().set('b2b_map', map);
            });
    } else {
        getPropertyFromFile(lru.FileID_Original, lru.constants.FileID_Objects, function (property) {
            if (!property) {
                lru.realtimeUtils.createRealtimeFile(lru.constants.FileID_Objects, function (createResponse) {
                    addPropertyToFile(lru.FileID_Original, lru.constants.FileID_Objects, createResponse.id, function () {
                        lru.createObjectsFile(callback);
                    });
                });
            } else {
                console.log("createObjectsFile: " + property);
                lru.FileID_Objects = property;
                lru.createObjectsFile(callback);
            }
        });
    }
};

/**
 *
 * @returns {boolean}
 */
LegionRealtimeUtils.prototype.amBully = function () {
    return !this.legion.bullyProtocol.amBullied();
};
