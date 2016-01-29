function GapiInterfaceHandler(objects, map) {
    this.objects = objects;
    this.map = map;
}

GapiInterfaceHandler.prototype.getModel = function () {
    return this;
};

GapiInterfaceHandler.prototype.getRoot = function () {
    return this;
};

GapiInterfaceHandler.prototype.get = function (id) {
    return new GapiObjectHandler(this.objects[this.map.get(id)]);
};

function GapiObjectHandler(object) {
    this.object = object;
}

GapiObjectHandler.prototype.items = function () {
    return this.object.items();
};

GapiObjectHandler.prototype.keys = function () {
    return this.object.keys();
};

GapiObjectHandler.prototype.remove = function (pos) {
    this.object.remove(pos);
};

GapiObjectHandler.prototype.insert = function (pos, val) {
    this.object.insert(pos, val);
};

GapiObjectHandler.prototype.has = function (key) {
    return this.object.contains(key);
};

GapiObjectHandler.prototype.delete = function (key) {
    this.object.remove(key);
};

GapiObjectHandler.prototype.set = function (key, value) {
    this.object.set(key, value);
};

GapiObjectHandler.prototype.asArray = function () {
    return this.object.getData();
};

GapiObjectHandler.prototype.addEventListener = function (event, callback) {
    switch (event) {
        case gapi.drive.realtime.EventType.TEXT_INSERTED:
            this.object.setOnStateChange(function () {
                callback();
            });
            break;
        case gapi.drive.realtime.EventType.TEXT_DELETED:
            this.object.setOnStateChange(function () {
                callback();
            });
            break;
        case gapi.drive.realtime.EventType.VALUES_ADDED:
            this.object.setOnStateChange(function () {
                callback();
            });
            break;
        case gapi.drive.realtime.EventType.VALUES_REMOVED:
            this.object.setOnStateChange(function () {
                callback();
            });
            break;
        case gapi.drive.realtime.EventType.VALUES_SET:
            this.object.setOnStateChange(function () {
                callback();
            });
            break;
        case gapi.drive.realtime.EventType.VALUE_CHANGED:
            this.object.setOnStateChange(function (newState, changes) {
                var ret = {};
                ret.property = changes.key;
                ret.newValue = changes.value;

                callback(ret);
            });
            break;
    }
};