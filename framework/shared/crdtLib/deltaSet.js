if (typeof exports != "undefined") {
    CRDT = require('./../crdt.js');
    CRDT = CRDT.CRDT;
    ALMap = require('./../ALMap.js');
    ALMap = ALMap.ALMap;
}

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
             * @param opNum {{id: {number}, opNum: {number}}}
             * @returns {{add: *}}
             */
            add: function (element, opNum) {
                console.warn("add", element, opNum, arguments);
                if (!this.state.adds.contains(element)) {
                    this.state.adds.set(element, new ALMap());
                    var e = this.state.adds.get(element);
                    e.set(opNum, true);
                    return {add: element};
                }
            },
            remove: function (element, opNum) {
                var e = this.state.adds.get(element);
                if (e) {
                    var data = {element: element, removes: e.keys()};
                    for (var i = 0; i < data.removes.length; i++) {
                        this.state.removes.set(data.removes[i], true);
                        e.delete(data.removes[i]);
                    }
                    if (e.size() == 0) {
                        this.state.adds.delete(data.element);
                        return {remove: data.element};
                    }
                }
            }
        },
        garbageCollect: function (gcvv) {
            var r_keys = this.state.removes.keys();
            for (var i = 0; i < r_keys.length; i++) {
                var key = JSON.parse(r_keys[i]);
                if (before(key, gcvv)) {
                    this.state.removes.delete(r_keys[i]);
                }
            }
        },
        getDelta: function (fromVV) {
            console.error("TODO: verify gcvv");
            console.error("TODO: if < vv then add ALL of my state instead");
            var ret = {has: false, adds: [], removes: []};

            var a_keys = this.state.adds.keys();
            for (var j = 0; j < a_keys.length; j++) {
                var e = this.state.adds.get(a_keys[j]);
                var unique_keys = e.keys();
                for (var k = 0; k < unique_keys.length; k++) {
                    var u_key = JSON.parse(unique_keys[k]);
                    if (after(u_key, fromVV)) {
                        ret.adds.push({key: a_keys[j], u: u_key});
                        ret.has = true;
                    }
                }
            }

            var r_keys = this.state.removes.keys();
            for (var i = 0; i < r_keys.length; i++) {
                var key = JSON.parse(r_keys[i]);
                if (after(key, fromVV)) {
                    ret.removes.push(r_keys[i]);
                    ret.has = true;
                }
            }

            return ret;
        },
        applyDelta: function (statePart, vv, gcvv) {
            console.log(this)
            /**
             *
             * @type {Array.<{key:{string}, u:{id:{number}, opNum:{number}}}>}
             */
            var adds = statePart.adds;
            /**
             *
             * @type {Array.<{id:{number}, opNum:{number}}>}
             */
            var removes = statePart.removes;

            //1 - every his thing: add

            //2- every my add: if < gcvv & ! in his thing. remove & dont add to removes!

            console.error("TODO: applyDelta");
            console.error(statePart);
            console.error(vv);
            console.error(gcvv);

            var temp_map = new ALMap();
            //1
            for (var i = 0; i < adds.length; i++) {
                var curr_add = adds[i];
                console.warn(curr_add);
                if (!this.state.adds.contains(curr_add.key)) {
                    this.state.adds.set(curr_add.key, new ALMap());
                    //TODO: new adds. bubble up a state change to external (app) interface.
                }
                var e = this.state.adds.get(curr_add.key);
                console.info(e);
                e.set(curr_add.u, true);
                console.info(e);
                console.info(e.get(curr_add.u));

                var temp_e = temp_map.get(curr_add.key);
                if (!temp_e) {
                    temp_e = new ALMap();
                    temp_map.set(curr_add.key, temp_e);
                }
                temp_e.set(curr_add.u, true)

            }
            for (var j = 0; j < removes.length; j++) {
                this.state.removes.set(removes[i], true);
            }

            //2
            var local_adds = this.state.adds.keys();
            for (var lai = 0; lai < local_adds.length; lai++) {
                var e = this.state.adds.get(local_adds[lai]);
                var l_e = e.keys();
                for (var lei = 0; lei < l_e.length; lei++) {
                    var p = JSON.parse(l_e[lei]);
                    if (after(p, gcvv)) {
                        //no op
                    } else {
                        if (!temp_map.contains(local_adds[lai])) {
                            e.delete(l_e[lei]);
                        } else {
                            var temp_e = temp_map.get(local_adds[lai]);
                            if (temp_e.contains(p)) {
                                //no op
                            } else {
                                e.delete(l_e[lei]);
                            }
                        }
                    }
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

/**
 *
 * @param key
 * @param vv {ALMap}
 * @returns {boolean}
 */
var before = function (key, vv) {
    if (vv.contains(key.id)) {
        return vv.get(key.id) > key.opNum;
    }
    return false;
};

/**
 *
 * @param key
 * @param vv {Object}
 * @returns {boolean}
 */
var after = function (key, vv) {
    if (vv[key.id]) {
        return vv[key.id] < key.opNum;
    }
    return true;
};