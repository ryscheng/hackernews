var http = require("http");
var cookie = require("cookie");
var fs = require("fs");
var microtime = require("microtime");
var child_process = require("child_process");

var PORT = 8000;
var DEFAULT_PROCESS_PORT = 7999;
var BOOT = "./boot.sh";

var processes = {
  "count": 1,
  "default": {
    port: DEFAULT_PROCESS_PORT,
    proc: null
  }
};
var server;

function addMissingProcess(user) {
  if (!processes.hasOwnProperty(user)) {
    processes[user] = {
      port: (PORT + processes["count"]),
      proc: null
    };
    processes["count"] += 1;
  }

  if (processes[user].proc == null) {
    console.log("Spawning web server on port: " + processes[user].port + 
                " for user: " + user);
    processes[user].proc = child_process.spawn(BOOT, [
      processes[user].port, 
      user
    ]);
    processes[user].proc.stdout.on('data', function (data) {
      console.log(user+':' + data);
    });
  }

}

function getRandomInt (min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getForwardingPort(request) {
  return getRandomInt((PORT+1),(PORT+processes["count"]-1));
}

function requestHandler(request, response) {
  var options = {
    hostname: "localhost",
    port: getForwardingPort(request),
    path: request.url,
    method: request.method,
    headers: request.headers
  };

  /**
  if (options.headers.hasOwnProperty("Host")) {
    options.headers["Host"] = options.hostname + ":" + options.port;
  }
  **/

  //DEBUG
  //console.log("---REQUEST---");
  //console.log(options);

  var forwardRequest = http.request(options, function(forwardResponse) {
    var headers = forwardResponse.headers;
    
    //DEBUG
    //console.log("---RESPONSE---");
    //console.log(headers);

    response.writeHead(forwardResponse.statusCode, headers);
    forwardResponse.on('data', function (chunk) {
      response.write(chunk);
    });
    forwardResponse.on('end', function() {
      response.end();
    });
  });
  
  forwardRequest.on('error', function(e) {
    console.log("Got error: " + e.message);
    response.writeHead(500, {"Content-Type": "text/plain"});
    response.write("Error: " + e);
    response.end();
  });
  request.on("data", function(chunk) {
    forwardRequest.write(chunk);
  });
  request.on("end", function() {
    forwardRequest.end();
  });

}

function initialize(numProcs) {
  console.log("Starting userrouter on port " + PORT);
  userProcesses = {};
  processes["default"].proc = child_process.spawn(BOOT, [
    processes["default"].port,
    "default"
  ]); 
  processes["default"].proc.stdout.on('data', function (data) {
    console.log('default:' + data);
  });
  server = http.createServer(requestHandler);

  for (var i=0; i<numProcs; i++) {
    addMissingProcess("user"+i);
  }
}

if (process.argv.length < 3) {
  console.log("node randorouter.js NUMPROCS");
} else {
  initialize(parseInt(process.argv[2]));
  server.listen(PORT);
}
