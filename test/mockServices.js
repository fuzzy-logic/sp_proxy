var http = require('http');

function endPointHandler(req, res) {
   res.writeHead(200, {'Content-Type': 'text/plain'});
   res.write('TestEndPoint: Hello, World!');
   res.end();
}

function registryHandler(req, res) {
   res.writeHead(200, {'Content-Type': 'application/json'});
   res.write(JSON.stringify({host: 'localhost', port: '3001'}) );
   res.end();
}

function httpStartupComplete(port) {
    console.log("starting http server on port " + port);
}



//create mock endpoint service to test proxy with 
http.createServer(endPointHandler).listen(3001, httpStartupComplete(3001));

//create mock registry
http.createServer(registryHandler).listen(8888, httpStartupComplete(8888));