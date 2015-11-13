//======================================================
// File: server.js
// Descr: Nodejs server for Saving Nemo
// 
// Author: Magnus Persson
// Date: 2014-01-31
//======================================================
//======================================================
// Configuration
//======================================================
var os = require('os');
var version = "0.1";
var port = process.env.PORT || 8082;

//======================================================
// Initialization
//======================================================
var server = require("http");

var mysql = require('mysql');
var connection = undefined;

DBConnect();
connection.query('CREATE TABLE IF NOT EXISTS players (id INTEGER NOT NULL AUTO_INCREMENT, PRIMARY KEY (id), name VARCHAR(13), score INT, clicks INT, date_played TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, host VARCHAR(50))', function(err, rows, fields) {
      if (err) throw err;
});
connection.end();


server = server.createServer(Handler);
//var io = require("socket.io").listen(server);
var webSocketServer = require('websocket').server;
var io = new webSocketServer({
  httpServer: server
});
io = io.on("request", SocketHandler);

var fs = require("fs");
var path = require("path");
var logger = require('util');
var sys = require('sys');
server.listen(port);



console.log("===================================");
console.log("Server for Saving Nemo");
console.log("Author: nergal");
console.log("Version: "+version);
console.log("===================================");
logger.log("Started server on port "+port);

//======================================================
//
// Server only stuff
//
//======================================================

function DBConnect() {
    var connurl = process.env.MYSQL_URI;
    if(connurl == undefined) {
        connection = mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: 'mypassword',
            database: 'nemo'
        });
    } else {
        connection = mysql.createConnection(connurl);
    }
    connection.connect();
}

// Socket handler
function SocketHandler(request) {
    var socket = request.accept(null, request.origin);
    logger.log("Incoming connection from "+socket.remoteAddresses[0]);

    socket.on("message", OnMessage.bind(this, socket));
}

function OnMessage(sock, msg) {
    data = JSON.parse(msg.utf8Data);
    switch(data.type) {
        case "GetScore":
               GetScore(data, sock);
            break;
        case "SetScore": 
                SetScore(data, sock);
                 break;
        case "GetHighScore":
                GetHighScore(data, sock);
                 break;
    }
}

// Set score
function SetScore(data) {
    console.log("SET HIGHSCORE, Clicks: "+data.x + " Score: "+data.score);
    if(data.name == undefined) {
        console.log("No name defined!");
        return;
    }
    data.name = data.name.substr(0,15);
    data.name = data.name.replace(/<\/?[^>]+(>|$)/g, "");
    if(data.x == 0) { 
        data.x = 1;
    }
    // Just some basic anti-cheat, not that bullet proof :)
    if(data.x < data.score/3) {
        console.log("WARNING>> Cheater detected. Clicks: "+data.x+  "Score: "+data.score);
        return;
    }
    var res = {host: os.hostname(), name: data.name, score: data.score, clicks: data.x};
    DBConnect();
    connection.query("insert into players set ?", res);
    connection.end();
}


// Get score
function GetScore(data, sock) {
    var s = sock;
    DBConnect();
    connection.query(
        'SELECT name, score, host, date_format(date_played, "%Y-%m-%d %H:%i:%s") as date_played from players order by score desc limit 10',
        function (err, rows, fields) {
            var data = [];
            for(var i = 0 ; i < rows.length; i++) {
                data.push({name: rows[i].name,
                          score: rows[i].score,
                          date: rows[i].date_played,
                          host: rows[i].host,
                });
            }
            s.sendUTF(JSON.stringify({ type: "scoreboard", score: data, host: os.hostname() }));
        }
    );
    connection.end();
}

// Get highscore
function GetHighScore(data, sock) {
    DBConnect();
    connection.query(
        'SELECT score from players order by score desc limit 10',
        function (err,rows,fields) {
            var data = -1;
            for(var i = 0 ; i < rows.length; i++) {
                if(data == -1) {
                    data = rows[i].score;
                }
                if(data > parseInt(rows[i].score)) {
                    data = rows[i].score;
                }
            }
            if(rows.length < 10) {
                data = 0;
            }
            sock.sendUTF(JSON.stringify({type: "highscore", score: data }));
        }
    );
    connection.end();
}
//======================================================
//
// Utility functions
//
//======================================================
function Length(obj) {
    return Object.keys(obj).length;
}

//======================================================
//
// Handler for web requests (webserver)
//
//======================================================
function Handler(req, res)
{                     
    var file = req.url;
    if(file == "/") {
        file = "./index.html";
    } else {
        file = "."+req.url;
    }
    var name = path.extname(file);
    var contentType;
    switch(name) {
        case '.html':
            case '.htm':
            contentType = 'text/html';
        break;
        case '.js':
            contentType = 'text/javascript';
        break;
        case '.css':
            contentType = 'text/css';
        break;
        case '.png':
            contentType = 'image/png';
        break;
        case '.jpg':
            contentType = 'image/jpg';
        break;
    }
    fs.exists(file, function(exists) {
        if(exists) {
            fs.readFile(file,function(err,data) {
                res.writeHead(200, {'Content-Type': contentType});
                res.end(data);
            });
        } else {
            res.writeHead(404, {'Content-Type': contentType});
            res.end("blubb blub said the file "+file);
        }
    });
}
