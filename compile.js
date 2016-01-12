var UglifyJS = require('uglify-js');
var walk = require('walk');

var files = [];
var walker1 = walk.walk('./framework/client/', {followLinks: false});
var walker2 = walk.walk('./framework/shared/', {followLinks: false});

var handler = function (root, stat, next) {
    console.error("Adding file: " + stat.name);
    files.push(root + '/' + stat.name);
    next();
};
var walker = 0;
var end = function () {
    if (++walker == 2) {
        var result = UglifyJS.minify(files);
        console.log(result.code);
    }
};

walker1.on('file', handler);
walker2.on('file', handler);

walker1.on('end', end);
walker2.on('end', end);

