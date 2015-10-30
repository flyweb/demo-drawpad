function startServer() {
  window.navigator.publishServer("DrawPad").then(server => {
    console.log("Published server: " + JSON.stringify(server));
    server.onrequest(requestEvent => {
      console.log('got request', requestEvent);
      var rawReq = requestEvent.requestRaw();
      var streamReader = new StreamReader(rawReq);
      console.log('stream reader', streamReader);
      streamReader.readHeader().then(reqinfo => {
        console.log("HEADER: ", reqinfo);
        var path = reqinfo.path;
        if (path == "/input-data") {
            serveWebSocket(requestEvent, streamReader, reqinfo.headers);
        } else {
            var playerNo;
            if (path == "/") {
                // Try to register a new player.
                player = addPlayer();
                serveFile(path, requestEvent, {__PLAYER__: player.id});
            }
            serveFile(path, requestEvent);
        }
      });
    });
  });
}

function mimeType(path) {
  var mimeType;
  if (path.indexOf('.html') !== -1 || path === '/') {
    mimeType = 'text/html';
  } else if (path.indexOf('.js') !== -1) {
    mimeType = 'application/javascript';
  } else if (path.indexOf('.css') !== -1) {
    mimeType = 'text/css';
  }
  return mimeType;
}

function serveFile(path, requestEvent, replacements) {
  requestEvent.stream().then(stream => {
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function() {
      if (!((xhr.readyState == 4) && (xhr.status == 200))) {
        console.log("Bad readystatechange", xhr.readyState, xhr.status);
        return;
      }
      console.log("Loaded data for path: " + path);
      var text = xhr.responseText;
      if (replacements) {
          for (var name in replacements) {
              var re = new RegExp(name, 'g');
              text = text.replace(re, replacements[name]);
          }
      }
      stream.send("HTTP/1.1 200 OK\r\n");
      stream.send("Content-Type: " + mimeType(path) + "\r\n");
      stream.send("Content-Length: " + text.length + "\r\n");
      stream.send("Access-Control-Allow-Origin: *\r\n");
      stream.send("\r\n");
      stream.send(text);
      stream.end();
    };
    var req_path = path;
    if (req_path == "/")
        req_path = "/index.html";
    req_path = "http://" + window.location.host + "/client" + req_path;
    console.log("Requesting for client: " + req_path);
    xhr.open("GET", req_path);
    xhr.responseType = 'text';
    xhr.send();
  });
}

function serveWebSocket(requestEvent, instream, headers) {
    requestEvent.stream().then(outstream => {
        var player = null;
        var cur_stroke = null;
        function onmessage(msg) {
            console.log("WebSocket got message: " + msg);
            var msgObj = JSON.parse(msg);
            if (msgObj.type == 'register') {
                // Register a new player.
                player = addPlayer();
                return;
            }
            if (msgObj.type == 'start' && player) {
                cur_stroke = player.addStroke();
                cur_stroke.addPoint(msgObj);
                return;
            }
            if (msgObj.type == 'move' && cur_stroke) {
                cur_stroke.addPoint(msgObj);
                return;
            }
            if (msgObj.type == 'end') {
                cur_stroke.end_time = Date.now();
                cur_stroke = null;
                return;
            }
        }
        function onerror(msg) {
            console.log("WebSocket got error: " + msg);
        }
        var ws = new ServerWebSocket({
            instream, outstream, headers, onmessage, onerror,
            stringMessage: true});
        window.SERVER_WS = ws;
    });
}
