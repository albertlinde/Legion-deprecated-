function ObjectServerConnection(server, objectStore, legion) {
    this.server = server;
    this.objectStore = objectStore;
    this.legion = legion;
    this.remoteID = this.server.ip + ":" + this.server.port;

    this.socket = new WebSocket("ws://" + this.server.ip + ":" + this.server.port + "");

    var sc = this;
    this.socket.onopen = function open() {
        sc.legion.generateMessage("CLIENT_ID", null, function (result) {
            result.clientID = sc.legion.id;
            sc.send(JSON.stringify(result));
        });
        sc.legion.connectionManager.onOpenServer(sc);
    };

    this.socket.onmessage = function (event) {
        var m = JSON.parse(event.data);
        console.log("Got " + m.type + " from " + sc.remoteID + " s: " + m.sender);
        var original = JSON.parse(event.data);
        if (m.content) {
            decompress(m.content, function (result) {
                m.content = JSON.parse(result);
                sc.objectStore.onMessageFromServer(m, original, sc);
            });
        } else {
            sc.objectStore.onMessageFromServer(m, original, sc);
        }
    };

    this.socket.onclose = function () {
        sc.legion.connectionManager.onCloseServer(sc);
    };

    this.socket.onerror = function (event) {
        console.error("ServerSocket Error", event);
    };

}

ObjectServerConnection.prototype.close = function () {
    this.socket.close();
};

ObjectServerConnection.prototype.send = function (message) {
    if (typeof message == "object") {
        message = JSON.stringify(message);
    }
    if (this.socket.readyState == WebSocket.OPEN) {
        console.log("Sent " + JSON.parse(message).type + " to " + this.remoteID + " s: " + JSON.parse(message).sender);
        this.socket.send(message);
    }
};