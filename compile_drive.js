var UglifyJS = require('uglify-js');
var walk = require('walk');

var files = [];
var walker = walk.walk('./extensions/', {followLinks: false});

var handler = function (root, stat, next) {
    if (stat.name.substr(stat.name.length - 3) == ".js") {
        console.error("Adding file: " + stat.name);
        files.push(root + '/' + stat.name);
    } else {
        console.error("Not adding file: " + stat.name);
    }
    next();
};

var end = function () {
    var result = UglifyJS.minify(files);
    console.log(result.code);
};

walker.on('file', handler);

walker.on('end', end);
