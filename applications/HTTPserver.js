var PORT = 8000;

var path = require('path');
var express = require('express');

var app = express();

app.get('/', function (req, res) {
    res.sendFile('index.html', {root: __dirname});
});

app.use(express.static('./'));
app.use(express.static('./../'));

var server = app.listen(PORT, function () {
    var host = server.address().address;
    var port = server.address().port;
    console.log('HTTP server listening at http://%s:%s', host, port)
});