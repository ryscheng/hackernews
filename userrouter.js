var http = require("http");
var cookie = require("cookie");
var fs = require("fs");
var child_process = require("child_process");

var PORT = 8000;
var DEFAULT_PROCESS_PORT = 7999;
var BOOT = "./boot.sh";
var HTTP_HEADERS = ["Accept", "Accept-Charset", "Accept-Encoding", 
  "Accept-Language", "Accept-Datetime", "Authorization", "Cache-Control",
  "Connection", "Cookie", "Content-Length", "Content-MD5", "Content-Type",
  "Date", "Expect", "From", "Host", "If-Match", "If-Modified-Since",
  "If-None-Match", "If-Range", "If-Unmodified-Since", "Max-Forwards",
  "Origin", "Pragma", "Proxy-Authorization", "Range", "Referer", "TE",
  "User-Agent", "Via", "Warning", "X-Requested-With", "DNT", "X-Forwarded-For",
  "X-Forwarded-Proto", "Front-End-Https", "X-ATT-DeviceId", "X-Wap-Profile",
  "Proxy-Connection", "Access-Control-Allow-Origin", "Accept-Ranges",
  "Age", "Allow", "Cache-Control", "Connection", "Content-Encoding",
  "Content-Language", "Content-Length", "Content-Location", "Content-MD5",
  "Content-Disposition", "Content-Range", "Content-Type", "Date", 
  "ETag", "Expires", "Last-Modified", "Link", "Location", "P3P",
  "Pragma", "Proxy-Authenticate", "Refresh", "Retry-After", "Server",
  "Set-Cookie", "Status", "Strict-Transport-Security", 
  "Trailer", "Transfer-Encoding", "Upgrade", "Vary", "Via", "Warning",
  "WWW-Authenticate", "X-Frame-Options", "Public-Key-Pins", "X-XSS-Protection",
  "Content-Security-Policy", "X-Content-Security-Policy", "X-WebKit-CSP",
  "X-Content-Type-Options", "X-Powered-By", "X-UA-Compatible"
];
var HTTP_HEADER_MAP;

var cookieUserMap = {};
var processes = {
  "count": 1,
  "default": {
    port: DEFAULT_PROCESS_PORT,
    proc: null
  }
};
var server;

function readCookies() {
  var data = fs.readFileSync('arc/cooks');
  var str = data.toString().replace(/[")]/g, '');
  var lines = str.split("(");
  for (var i=0; i<lines.length; i++) {
    var tokens = lines[i].split(" ");
    if (tokens.length > 1) {
      cookieUserMap[tokens[0]] = tokens[1];
    }
  }
  return;
}

function fixHeaders(old) {
  var result = {};
  for (var key in old) {
    if (old.hasOwnProperty(key)) {
      result[HTTP_HEADER_MAP[key]] = old[key]
    }
  }
  return result;
}

function getForwardingPort(request) {
  if (!request.headers.hasOwnProperty("cookie")){
    console.log("Route: default: Missing cookies");
    return processes["default"].port;
  }

  var cookies = cookie.parse(request.headers.cookie);
  if (!cookies.hasOwnProperty("user")) {
    console.log("Route: default: Missing 'user' in cookies: " + request.headers.cookie);
    return processes["default"].port;
  }

  var cook = cookies["user"];
  if (!cookieUserMap.hasOwnProperty(cook)) {
    readCookies();
  } 

  if (!cookieUserMap.hasOwnProperty(cook)) {
    console.log("Route: default: cookie doesn't exist in cookie map: " + cook);
    console.log(cookieUserMap);
    return processes["default"].port;
  }

  var user = cookieUserMap[cook];
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

  console.log("Routing request for user " + user + " to port " +
    processes[user].port);
  return processes[user].port;
  //return processes["default"].port;
}

function requestHandler(request, response) {
  var options = {
    hostname: "localhost",
    port: getForwardingPort(request),
    path: request.url,
    method: request.method,
    headers: fixHeaders(request.headers)
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
    var headers = fixHeaders(forwardResponse.headers);
    
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

function initialize() {
  userProcesses = {};
  processes["default"].proc = child_process.spawn(BOOT, [
    processes["default"].port,
    "default"
  ]); 
  processes["default"].proc.stdout.on('data', function (data) {
    console.log('default:' + data);
  });
  readCookies();
  server = http.createServer(requestHandler);
  HTTP_HEADER_MAP = {};
  HTTP_HEADERS.forEach(function(x) {
    HTTP_HEADER_MAP[x.toLowerCase()] = x;
  });
}

console.log("Starting userrouter on port " + PORT);
initialize();
server.listen(PORT);

