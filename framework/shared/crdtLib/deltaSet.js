if (typeof exports != "undefined") {
    CRDT = require('./../crdt.js');
    CRDT = CRDT.CRDT;
    ALMap = require('./../ALMap.js');
    ALMap = ALMap.ALMap;
}

var TOMBSTONE_THRESHOLD = 10;

var delta_set = {
    type: "DELTA_Set",
    propagation: CRDT.DELTA_BASED,
    crdt: {
        base_value: {
            state: {adds: ALMap, removes: ALMap}
        },
        getValue: function () {
            return this.state.adds.keys();
        },
        operations: {
            /**
             *
             * @param element {Object}
             * @param o {{id: {number}, o: {number}}}
             * @returns {{add: *}}
             */
            add: function (element, o) {
                if (objectsDebug)console.warn("add", element, o, arguments);
                if (!this.state.adds.contains(element)) {
                    this.state.adds.set(element, new ALMap());
                    var e = this.state.adds.get(element);
                    e.set(o, true);
                    return {add: element};
                }
            },
            remove: function (element, o) {
                var ret = null;
                var e = this.state.adds.get(element);
                if (e) {
                    var data = {element: element, removes: e.keys()};
                    for (var i = 0; i < data.removes.length; i++) {
                        this.state.removes.set(o, data.removes[i]);
                        e.delete(data.removes[i]);
                    }
                    if (e.size() == 0) {
                        this.state.adds.delete(data.element);
                        ret = {remove: data.element};
                    }
                }

                if (this.state.removes.size() >= TOMBSTONE_THRESHOLD) {
                    var gcvv = {};
                    var vv = this.getVersionVector();
                    var vvkeys = Object.keys(vv);
                    for (var i = 0; i < vvkeys.length; i++) {
                        if (vv[vvkeys[i]] > 3) {
                            gcvv[vvkeys[i]] = vv[vvkeys[i]] - 3;
                        }
                    }
                    console.info(gcvv);
                    this.garbageCollect(gcvv);
                }
                return ret;

            }
        },
        garbageCollect: function (gcvv) {
            var r_keys = this.state.removes.keys();
            for (var i = 0; i < r_keys.length; i++) {
                var val = this.state.removes.get(r_keys[i]);
                if (before(val, gcvv) || before(JSON.parse(r_keys[i]), gcvv)) {
                    this.state.removes.delete(r_keys[i]);
                }
            }

            var gvv_keys = Object.keys(gcvv);
            for (var i = 0; i < gvv_keys.length; i++) {
                var key = gvv_keys[i];
                if (this.gcvv[key])
                    this.gcvv[key] = Math.max(gcvv[key], this.gcvv[key]);
                else
                    this.gcvv[key] = gcvv[key];
            }
        },
        getDelta: function (fromVV, gcvv) {
            var ret = {has: false, adds: [], removes: []};

            var all = false;
            var his_vv_keys = Object.keys(fromVV);
            for (var hvi = 0; hvi < his_vv_keys.length; hvi++) {
                if (before({id: his_vv_keys[hvi], o: fromVV[his_vv_keys[hvi]]}, this.gcvv)) {
                    console.warn("from < gcvv");
                    all = true;
                    break;
                }
            }

            var a_keys = this.state.adds.keys();
            for (var j = 0; j < a_keys.length; j++) {
                var e = this.state.adds.get(a_keys[j]);
                var unique_keys = e.keys();
                for (var k = 0; k < unique_keys.length; k++) {
                    var u_key = JSON.parse(unique_keys[k]);
                    if (all == true || after(u_key, fromVV)) {
                        ret.adds.push({key: a_keys[j], u: u_key});
                        ret.has = true;
                    }
                }
            }

            var r_keys = this.state.removes.keys();
            for (var i = 0; i < r_keys.length; i++) {
                var val = this.state.removes.get(r_keys[i]);
                if (all == true || after(val, fromVV) || after(JSON.parse(r_keys[i]), fromVV)) {
                    ret.removes.push({key: r_keys[i], u: val});
                    ret.has = true;
                }
            }

            return ret;
        },
        applyDelta: function (statePart, vv, gcvv) {
            /**
             *
             * @type {Array.<{key:{string}, u:{id:{number}, o:{number}}}>}
             */
            var adds = statePart.adds;
            /**
             *
             * @type {Array.<{key:{string}, u:{id:{number}, o:{number}}}>}
             */
            var removes = statePart.removes;

            //1 - every his thing: add

            //2- every my add: if < gcvv & ! in his thing. remove & dont add to removes!

            if (objectsDebug)console.log("applyDelta");
            if (objectsDebug)console.log(statePart);
            if (objectsDebug)console.log(vv);
            if (objectsDebug)console.log(gcvv);

            var temp_map = new ALMap();
            //1
            for (var i = 0; i < adds.length; i++) {
                var curr_add = adds[i];
                if (!this.state.adds.contains(curr_add.key)) {
                    this.state.adds.set(curr_add.key, new ALMap());
                    //TODO: new adds. bubble up a state change to external (app) interface.
                }
                var e = this.state.adds.get(curr_add.key);
                e.set(curr_add.u, true);
                var temp_e = temp_map.get(curr_add.key);
                if (!temp_e) {
                    temp_e = new ALMap();
                    temp_map.set(curr_add.key, temp_e);
                }
                temp_e.set(curr_add.u, true)

            }
            for (var j = 0; j < removes.length; j++) {
                var curr_rem = removes[j];
                this.state.removes.set(curr_rem.key, curr_rem.u);
            }

            var im_behind = false;
            var vv = Object.keys(this.getVersionVector());
            for (var i = 0; i < vv.length; i++) {
                var k = this.getVersionVector()[vv[i]];
                if (gcvv[vv[i]]) {
                    if (gcvv[vv[i]] > k) {
                        im_behind = true;
                        break;
                    }
                }
            }

            //2
            var local_adds = this.state.adds.keys();
            for (var lai = 0; lai < local_adds.length; lai++) {
                var e = this.state.adds.get(local_adds[lai]);
                var l_e = e.keys();
                for (var lei = 0; lei < l_e.length; lei++) {
                    for (var j = 0; j < removes.length; j++) {
                        if (l_e[lei] == removes[j].u) {
                            e.delete(l_e[lei]);
                        }
                    }
                    if (im_behind) {
                        var p = JSON.parse(l_e[lei]);
                        if (after(p, gcvv)) {
                        } else {
                            if (!temp_map.contains(local_adds[lai])) {
                                e.delete(l_e[lei]);
                            } else {
                                var temp_e = temp_map.get(local_adds[lai]);
                                if (temp_e.contains(p)) {
                                } else {
                                    e.delete(l_e[lei]);
                                }
                            }
                        }
                    }
                }
                if (e.size() == 0) {
                    this.state.adds.delete(local_adds[lai]);
                    //TODO: new remove. bubble up a state change to external (app) interface.
                }
            }
            //thats it? :/
        }
    }
};//ooooh so many curly braces

if (typeof exports != "undefined") {
    exports.DELTA_Set = delta_set;
} else {
    CRDT_LIB.DELTA_Set = delta_set;
}

var before = function (key, vv) {
    if (vv instanceof ALMap) {
        if (vv.contains(key.id)) {
            return vv.get(key.id) > key.o;
        }
        return false;
    } else {
        if (vv[key.id]) {
            return vv[key.id] > key.o;
        }
        return false;
    }
};

/**
 *
 * @param key
 * @param vv {Object}
 * @returns {boolean}
 */
var after = function (key, vv) {

    if (vv instanceof ALMap) {
        if (vv.contains(key.id)) {
            return vv.get(key.id) < key.o;
        }
        return true;
    } else {
        if (vv[key.id]) {
            return vv[key.id] < key.o;
        }
        return true;
    }
};