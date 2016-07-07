if (typeof generateUniqueIdentifier == "undefined") {
    generateUniqueIdentifier = function () {
        return ("" + Math.random()).substr(2);
    }
}

if (typeof exports != "undefined") {
    CRDT = require('./../crdt.js');
    CRDT = CRDT.CRDT;
    ALMap = require('./../ALMap.js');
    ALMap = ALMap.ALMap;
}

//TODO: Add support to redis operations
var state_map = {
    type: "STATE_Map",
    propagation: CRDT.STATE_BASED,
    crdt: {
        base_value: {
            /*
             adds: (key, ALMap). ALMap: element, ALMap2. ALMap2: unique, true
             removes: (unique, true)
             */
            state: {adds: ALMap, removes: ALMap}
        },
        getValue: function () {
            var ret = {};
            var keys = this.state.adds.keys();
            for (var i = 0; i < keys.length; i++) {
                ret[keys[i]] = this.state.adds.get(keys[i]).keys();
            }
            return ret;
        },
        /*
         getValue: function(key) {
         if (!this.state.contains(key))
         return [];
         //Returns all elements associated to that key
         return this.state.adds.get(key).keys();
         },
         */
        operations: {
            asArray: function () {
                var ret = [];
                var keys = this.state.adds.keys();
                for (var i = 0; i < keys.length; i++) {
                    ret.push([keys[i], this.state.adds.get(keys[i]).keys()]);
                }
                return ret;
            },
            set: function (key, element) {
                var unique = generateUniqueIdentifier();
                var elements;
                var removed = [];
                var ret = {};
                var anyRemove = false;
                var removes = this.state.removes;
                //No need to check if the unique is in the removes... since each unique only appears in one add
                if (this.state.adds.contains(key)) {
                    elements = this.state.adds.get(key);
                    var elementsKeys = elements.keys();
                    for (var i = 0; i < elementsKeys.length; i++) {
                        //Removes elements that aren't equal to the one adding but are still associated to that key
                        if (element != elementsKeys[i]) {
                            anyRemove = true;
                            var uniques = elements.get(elementsKeys[i]).keys();
                            for (var j = 0; j < uniques.length; j++)
                                removes.set(uniques[j], true);
                            elements.delete(elementsKeys[i]);
                            removed.push(elementsKeys[i]);
                        }
                    }
                    if (!anyRemove)
                        return {change: false};
                }
                else {
                    this.state.adds.set(key, new ALMap());
                    elements = this.state.adds.get(key);
                }
                ret.removes = removed;
                if (!elements.contains(element))
                    elements.set(element, new ALMap());
                if (!elements.get(element).contains(unique)) {
                    elements.get(element).set(unique, true);
                    if (!anyRemove)
                        ret.change = {key: key, value: element};
                    else
                        ret.add = {key: key, value: element};
                }
                else
                    console.error("Duplicate unique");
                ret.change = true;
                return ret;
            },
            delete: function (key) {
                var ret = {removes: []};
                if (!this.state.adds.contains(key))
                    return ret;
                var elements = this.state.adds.get(key);
                var removed = elements.keys();
                for (var i = 0; i < removed.length; i++) {
                    var currentElement = elements.get(removed[i]);
                    var uniques = currentElement.keys();
                    for (var j = 0; j < uniques.length; j++)
                        this.state.removes.set(uniques[j], true);
                    elements.delete(removed[i]);
                    ret.removes.push({key: key, value: removed[i]});
                }
                this.state.adds.delete(key);
                ret.change = true;
                return ret;
            },
            contains: function (key) {
                return this.state.adds.contains(key);
            },
            get: function (key) {
                return this.state.adds.get(key).keys();
            },
            keys: function () {
                return this.state.adds.keys();
            },
            addRemoveUniques: function (removesArray) {
                for (var i = 0; i < removesArray.length; i++) {
                    if (!this.state.removes.contains(removesArray[i]))
                        this.state.removes.set(removesArray[i], true);
                }

                var crdtAdds = this.state.adds;
                var crdtAddKeys = crdtAdds.keys();
                var crdtRemoves = this.state.removes;
                for (var i = 0; i < crdtAddKeys.length; i++) {
                    var elementsMap = crdtAdds.get(crdtAddKeys[i]);
                    var elementsKeys = elementsMap.keys();
                    for (var j = 0; j < elementsKeys.length; j++) {
                        var uniquesMap = elementsMap.get(elementsKeys[j]);
                        var uniquesKeys = uniquesMap.keys();
                        for (var k = 0; k < uniquesKeys.length; k++)
                            if (crdtRemoves.contains(uniquesKeys[k]))
                                uniquesMap.delete(uniquesKeys[k]);
                        if (uniquesMap.size() == 0)
                            elementsMap.delete(elementsKeys[j]);
                    }
                    if (elementsMap.size() == 0)
                        crdtAdds.delete(crdtAddKeys[i]);
                }

                //return null;
                return {addRemoveUniques: removesArray};
            },
            addRedisAddsAndRemovesUniques: function (newCRDTAdds) {
                //var newCRDTAddsKeys = newCRDTAdds.keys();
                var newCRDTAddsKeys = Object.keys(newCRDTAdds);
                var crdtAdds = this.state.adds;
                var crdtRemoves = this.state.removes;
                for (var i = 0; i < newCRDTAddsKeys.length; i++) {
                    if (!crdtAdds.contains(newCRDTAddsKeys[i])) {
                        var map = new ALMap();
                        crdtAdds.set(newCRDTAddsKeys[i], map);
                    }
                    var elementsMap = crdtAdds.get(newCRDTAddsKeys[i]);
                    //var newCRDTElementsMap = newCRDTAdds.get(newCRDTAddsKeys[i]);
                    //var newCRDTElementsKeys = newCRDTElementsMap.keys();
                    var newCRDTElementsObj = newCRDTAdds[newCRDTAddsKeys[i]];
                    var newCRDTElementsKeys = Object.keys(newCRDTElementsObj);
                    //Only one element
                    //var newCRDTUniquesMap = newCRDTElementsMap.get(newCRDTElementsKeys[0]);
                    //var newCRDTUniquesKeys = newCRDTUniquesMap.keys();
                    var newCRDTUniquesKey = newCRDTElementsObj[newCRDTElementsKeys];
                    //var changedElement = false;
                    //console.log("new Element key: " + newElementKey);
                    //Element changed/new element
                    if (!elementsMap.contains(newCRDTElementsKeys[0])) {
                        //if (elementsMap.size() > 0)
                        //changedElement = true;
                        var map = new ALMap();
                        elementsMap.set(newCRDTElementsKeys[0], map);
                    }
                    //In this case, we need to remove all the other elements
                    /*
                     if (changedElement) {
                     //console.log("#####REDIS CHANGED ELEMENT DETECTED!!!#####");
                     var elementsKeys = elementsMap.keys();
                     for (var j = 0; j < elementsKeys.length; j++) {
                     if (elementsKeys[j] != newCRDTElementsKeys[0]) {
                     //console.log("new Element key: " + newElementKey);
                     //console.log("old Element key: " + elementsKeys[j]);
                     var uniquesMap = elementsMap.get(elementsKeys[j]);
                     var uniquesKeys = uniquesMap.keys();
                     for (var l = 0; l < uniquesKeys.length; l++)
                     crdtRemoves.set(uniquesKeys[l], true);
                     elementsMap.delete(elementsKeys[j]);
                     }
                     }
                     }
                     */
                    var uniquesMap = elementsMap.get(newCRDTElementsKeys[0]);
                    //var newUniquesKeys = Object.keys(newUniquesMap);
                    /*
                     for (var j = 0; j < newCRDTUniquesKeys.length; j++)
                     if (!uniquesMap.contains(newCRDTUniquesKeys[j]) && !crdtRemoves.contains(newCRDTUniquesKeys[j]))
                     uniquesMap.set(newCRDTUniquesKeys[j], true);
                     */
                    if (!uniquesMap.contains(newCRDTUniquesKey) && !crdtRemoves.contains(newCRDTUniquesKey))
                        uniquesMap.set(newCRDTUniquesKey, true);
                    if (uniquesMap.size() == 0) {
                        elementsMap.delete(newCRDTElementsKeys[0]);
                        if (elementsMap.size() == 0)
                            crdtAdds.delete(newCRDTAddsKeys[i]);
                    }
                }
            }
        },
        /*
         Four options:
         - CRDT.STATE.COMPARE_RESPONSE.EQUALS: both CRDTs are equal
         - CRDT.STATE.COMPARE_RESPONSE.LOWER: the remote is "lower" than the local, which means the local has everything that the remote has + some stuff
         - CRDT.STATE.COMPARE_RESPONSE.HIGHER: the remote is "higher" than the local, which means the remote has everything that the local has + some stuff (which means we could change the local copy with the remote one)
         - CRDT.STATE.COMPARE_RESPONSE.MUST_MERGE: both CRDTs are different. Each one has stuff that the other one doesn't
         */
        compare: function (local, remote) {
            //moreLocal: there were local adds or removes that didn't happen on remote
            var moreLocal = false;
            //moreRemote: there were remote adds or removes that didn't happen on local
            var moreRemote = false;

            //First, let's compare the removes.
            //Now, let's see if there's any remove on local that isn't on remote
            var localRemovesKeys = local.removes.keys();
            for (var i = 0; i < localRemovesKeys.length; i++) {
                //There was a local remove. So the local has a newer version or there needs to be a merge...
                if (!remote.removes.contains(localRemovesKeys[i])) {
                    moreLocal = true;
                    break;
                }
            }

            //Now, we'll check if there's any remove on remote that isn't on local
            var remoteRemovesKeys = remote.removes.keys();
            for (var i = 0; i < remoteRemovesKeys.length; i++) {
                //There was a remote remove. So the remote has a newer version or there needs to be a merge...
                if (!local.removes.contains(remoteRemovesKeys[i])) {
                    moreRemote = true;
                    break;
                }
            }

            if (!moreLocal || !moreRemote) {
                //Now, we're going to check the local adds. We'll then, for each unique in local adds, check the remote adds and removes to detect local adds or remote removes.
                var localAddKeys = local.adds.keys();
                //We can't conclude directly from the lack of a key/element, we need to compare the uniques... For example, a local might have an extra key because there was a remove on remote... so moreLocal should still be false
                for (var i = 0; i < localAddKeys.length; i++) {
                    var localElements = local.adds.get(localAddKeys[i]);
                    var localElementsKeys = localElements.keys();
                    if (remote.adds.contains(localAddKeys[i])) {
                        var remoteElements = remote.adds.get(localAddKeys[i]);
                        for (var j = 0; j < localElementsKeys.length; j++) {
                            var localUniquesKeys = localElements.get(localElementsKeys[j]).keys();
                            if (remoteElements.contains(localElementsKeys[j])) {
                                var remoteUniques = remoteElements.get(localElementsKeys[j]);
                                for (var k = 0; k < localUniquesKeys.length; k++) {
                                    //This unique is in the local adds copy but not on the remote adds
                                    if (!remoteUniques.contains(localUniquesKeys[k])) {
                                        //This means that there was a local add. As such, we either have a more recent version of the CRDT or the CRDTs need to be merged
                                        if (!remote.removes.contains(localUniquesKeys[k]))
                                            moreLocal = true;
                                        //This means that there was a remote remove of that unique. As such, the remote has a more recent version of the CRDT or the CRDTs need to be merged
                                        else
                                            moreRemote = true;
                                        if (moreLocal && moreRemote)
                                            return CRDT.STATE.COMPARE_RESPONSE.MUST_MERGE;
                                    }
                                }
                            }
                            //Check below logic for keys. Same applies to elements
                            else
                                for (var k = 0; k < localUniquesKeys.length; k++) {
                                    //Local Add
                                    if (!remote.removes.contains(localUniquesKeys[k]))
                                        moreLocal = true;
                                    //Remote remove
                                    else
                                        moreRemote = true;
                                    if (moreLocal && moreRemote)
                                        return CRDT.STATE.COMPARE_RESPONSE.MUST_MERGE;
                                }
                        }
                    }
                    /*
                     If there's a key on local that isn't on remote, it might either be because of a local add or a remote remove.
                     If it is because of a remote remove, then moreRemote is true because of the removes comparation.
                     However, it might still be a local add (the difference on the removes might be because of a remote remove of an unique of another key/element). It might even be both.
                     */
                    else {
                        for (var j = 0; j < localElementsKeys.length; j++) {
                            var currentElement = localElements.get(localElementsKeys[j]);
                            var localUniquesKeys = currentElement.keys();
                            for (var k = 0; k < localUniquesKeys.length; k++) {
                                //Local Add
                                if (!remote.removes.contains(localUniquesKeys[k]))
                                    moreLocal = true;
                                //Remote remove
                                else
                                    moreRemote = true;
                                if (moreLocal && moreRemote)
                                    return CRDT.STATE.COMPARE_RESPONSE.MUST_MERGE;
                            }
                        }
                    }
                }

                //Now it's time to check the remote adds. For each unique there, we'll check the local adds and removes, to detect remote adds and local removes
                var remoteAddsKeys = remote.adds.keys();
                for (var i = 0; i < remoteAddsKeys.length; i++) {
                    var remoteElements = remote.adds.get(remoteAddsKeys[i]);
                    var remoteElementsKeys = remoteElements.keys();
                    //We can't do anything on else... it might be because of either a local remove (we don't know the uniques so we can't find out if it was a local remove) or a remote add.
                    if (local.adds.contains(remoteAddsKeys[i])) {
                        var localElements = local.adds.get(remoteAddsKeys[i]);
                        for (var j = 0; j < remoteElementsKeys.length; j++) {
                            var remoteUniquesKeys = remoteElements.get(remoteElementsKeys[j]).keys();
                            if (localElements.contains(remoteElementsKeys[j])) {
                                var localUniques = localElements.get(remoteElementsKeys[j]);
                                for (var k = 0; k < remoteUniquesKeys.length; k++) {
                                    //An unique that is on the remote CRDT adds but not in the local adds
                                    if (!localUniques.contains(remoteUniquesKeys[k])) {
                                        //An unique that is on the remote CRDT adds and is not on the local remove or adds. That means it is a remote add
                                        if (!remote.removes.contains(remoteUniquesKeys[k]))
                                            moreRemote = true;
                                        //An unique that is on the remote CRDT adds and on the local remove. This means it is a local remove
                                        else
                                            moreLocal = true;
                                        if (moreLocal && moreRemote)
                                            return CRDT.STATE.COMPARE_RESPONSE.MUST_MERGE;
                                    }
                                }
                            }
                            //Check above logic for keys. Same applies to elements. Swap local and remote.
                            else
                                for (var k = 0; k < remoteUniquesKeys.length; k++) {
                                    if (!local.removes.contains(remoteUniquesKeys[k]))
                                        moreRemote = true;
                                    else
                                        moreLocal = true;
                                    if (moreLocal && moreRemote)
                                        return CRDT.STATE.COMPARE_RESPONSE.MUST_MERGE;
                                }
                        }
                    }
                    //Check above logic for keys. Swap local and remote.
                    else {
                        for (var j = 0; j < remoteElementsKeys.length; j++) {
                            var currentElement = remoteElements.get(remoteElementsKeys[j]);
                            var remoteUniquesKeys = currentElement.keys();
                            for (var k = 0; k < remoteUniquesKeys.length; k++) {
                                if (!local.removes.contains(remoteUniquesKeys[k]))
                                    moreRemote = true;
                                else
                                    moreLocal = true;
                                if (moreLocal && moreRemote)
                                    return CRDT.STATE.COMPARE_RESPONSE.MUST_MERGE;
                            }
                        }
                    }
                }
            }
            if (!moreRemote && !moreLocal)
                return CRDT.STATE.COMPARE_RESPONSE.EQUALS;
            if (!moreRemote)
                return CRDT.STATE.COMPARE_RESPONSE.LOWER;
            if (!moreLocal)
                return CRDT.STATE.COMPARE_RESPONSE.HIGHER;
            return CRDT.STATE.COMPARE_RESPONSE.MUST_MERGE;
        },
        //Both local and remote are states
        merge: function (local, remote) {
            //First we'll merge the removes
            var remoteRemovesUniques = remote.removes.keys();
            for (var i = 0; i < remoteRemovesUniques.length; i++) {
                if (!local.removes.contains(remoteRemovesUniques[i]))
                    local.removes.set(remoteRemovesUniques[i], true);
            }

            //Now we'll look at local adds and remove the uniques that are on the new remove map
            var localAddsKeys = local.adds.keys();
            for (var i = 0; i < localAddsKeys.length; i++) {
                var elements = local.adds.get(localAddsKeys[i]);
                var elementsKeys = elements.keys();
                for (var j = 0; j < elementsKeys.length; j++) {
                    var uniques = elements.get(elementsKeys[j]);
                    var uniquesKeys = uniques.keys();
                    for (var k = 0; k < uniquesKeys.length; k++) {
                        if (local.removes.contains(uniquesKeys[k]))
                            uniques.delete(uniquesKeys[k]);
                    }
                    if (uniques.size() == 0)
                        elements.delete(elementsKeys[j]);
                }
                if (elements.size() == 0)
                    local.adds.delete(localAddsKeys[i]);
            }

            //Now we iterate the remote add map and add the uniques that aren't on the new remove and on the local add
            var remoteAddsKeys = remote.adds.keys();
            for (var i = 0; i < remoteAddsKeys.length; i++) {
                var remoteElements = remote.adds.get(remoteAddsKeys[i]);
                //var remoteElementsKeys = elements.keys();
                var remoteElementsKeys = remoteElements.keys();
                //If this ends up empty we'll need to remove it
                if (!local.adds.contains(remoteAddsKeys[i]))
                    local.adds.set(remoteAddsKeys[i], new ALMap());
                var localElements = local.adds.get(remoteAddsKeys[i]);
                for (var j = 0; j < remoteElementsKeys.length; j++) {
                    //Once again, if this ends up empty we'll need to remove it
                    if (!localElements.contains(remoteElementsKeys[j]))
                        localElements.set(remoteElementsKeys[j], new ALMap());
                    var localUniques = localElements.get(remoteElementsKeys[j]);
                    var remoteUniquesKeys = remoteElements.get(remoteElementsKeys[j]).keys();
                    for (var k = 0; k < remoteUniquesKeys.length; k++) {
                        if (!localUniques.contains(remoteUniquesKeys[k]))
                            if (!local.removes.contains(remoteUniquesKeys[k]))
                                localUniques.set(remoteUniquesKeys[k], true);
                    }
                    if (localUniques.size() == 0)
                        localElements.delete(remoteElementsKeys[j]);
                }
                if (localElements.size() == 0)
                    local.adds.delete(remoteAddsKeys[i]);
            }
            var result = {};
            result["mergeResult"] = local;
            //return local;
            return result;
        },
        fromJSONString: function (jsObject) {
            var adds = new ALMap();
            var removes = new ALMap();

            var addsArray = jsObject.adds;
            var removesArray = jsObject.removes;

            //First the removes
            for (var i = 0; i < removesArray.length; i++)
                removes.set(removesArray[i], true);

            //Now, the adds. Check toJSONString for the "array" structure
            for (var i = 0; i < addsArray.length; i++) {
                var elementsMap = new ALMap();
                var key = addsArray[i][0][0];
                var elementsLength = addsArray[i][0][1];
                for (var j = 0; j < elementsLength; j++) {
                    var element = addsArray[i][j + 1][0];
                    var uniquesMap = new ALMap();
                    var uniquesLength = addsArray[i][j + 1][1];
                    for (var k = 0; k < uniquesLength; k++)
                        uniquesMap.set(addsArray[i][j + 1][2 + k], true);
                    elementsMap.set(element, uniquesMap);
                }
                adds.set(key, elementsMap);
            }
            return {adds: adds, removes: removes};
        },
        toJSONString: function (state) {
            var adds = state.adds;
            var removes = state.removes;

            var addsArray = [];
            var removesArray = [];

            //First the removes.
            removesArray = removes.keys();

            /*
             Now, the adds.
             The addsArray will be a [][][]
             At [i][0][0], we store the key name. At [i][0][1], we store the number of elements. Let's say j is the current element number
             Then, at [i][j + 1][0], we store the element name. At [i][j + 1][1], we store the number of uniques of that element. From [i][j + 1][2] to [i][j + 1][2 + uniquesLength], the uniques are stored (only their names)
             */
            var addsKeys = adds.keys();
            for (var i = 0; i < addsKeys.length; i++) {
                var elementsMap = adds.get(addsKeys[i]);
                var elementsKeys = elementsMap.keys();
                var elementsArray = [];
                //elementsMatrix[0][0] = addsKeys[i];
                //elementsMatrix[0][1] = elementsKeys.length;
                //Inicial information (key and number of elements)
                var infoArray = [];
                infoArray[0] = addsKeys[i];
                infoArray[1] = elementsKeys.length;
                elementsArray.push(infoArray);
                for (var j = 0; j < elementsKeys.length; j++) {
                    var uniquesArray = [];
                    uniquesArray[0] = elementsKeys[j];
                    var uniquesMap = elementsMap.get(elementsKeys[j]);
                    var uniquesKeys = uniquesMap.keys();
                    uniquesArray[1] = uniquesKeys.length;
                    for (var k = 0; k < uniquesKeys.length; k++)
                        uniquesArray[2 + k] = uniquesKeys[k];
                    elementsArray.push(uniquesArray);
                }
                addsArray.push(elementsArray);
            }
            return {adds: addsArray, removes: removesArray};
        }
    }
}

if (typeof exports != "undefined") {
    exports.STATE_Map = state_map;
} else {
    CRDT_LIB.STATE_Map = state_map;
}