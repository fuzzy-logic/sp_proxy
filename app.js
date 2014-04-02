http = require('http');
var url = require('url');
var _ = require('underscore');



var port = process.env.SP_PROXY_PORT || 8080;
var BAD_GATEWAY_RESPONSE_CODE = 502;
var X_FORWARDED_FOR_HEADER = 'x-forwarded-for';
var endPointPort = 3000;

http.createServer(proxyHandler).listen(port, _httpStartupComplete);


var REQUEST_RESPONSE_EVENTS = {
    ERROR: 'error',
    DATA: 'data',
    END: 'end',
    CLOSE: 'close'
};


function _httpStartupComplete() {
    'use strict';
    console.log("starting http server on port " + port);
}

function proxyHandler(req, res) {
    'use strict';
    req.clientIp = req.headers[X_FORWARDED_FOR_HEADER] || req.connection.remoteAddress;
    handleRequest(req, res);
}

function handleRequest(clientRequest, clientResponse) {
    var servicename = clientRequest.headers.host;   
     console.log('handleRequest() servicename=' + servicename)
    getServiceHost(servicename, proxyRequest(clientRequest, clientResponse) );
}


function getServiceHost(servicename, callback) {
    console.log('getServiceHost() servicename=' + servicename);
     var url = 'http://localhost:8888/service';
    
     var options = {
        method: 'GET',
        hostname: 'localhost',
        host: 'localhost',
        port: 8888,
        path: '/service/' + servicename + '/host/next',
        headers: ['Accept: application/json']
    };
    
    registryCallback = function(response) {
        console.log('Reponse: ', response.statusCode, ' from url: ', url);
        var body = '';
        response.on('data', function(chunk){
            console.log('getServiceHost() response.on("data"): data=' + chunk);
            body += chunk;
        });
        
         response.on('error', function(chunk){
            console.log('getServiceHost() response.on("error")');
        });

        response.on('end', function() {
            console.log('getServiceHost() response.on("end")');
            callback(body.host);
        });
    };
    
    
   var registryRequest = http.request(options, registryCallback);
    registryRequest.on('error', function(e){
        console.log('getServiceHost() registryRequest.on("error") Error: ', e.message);
    });
    
    console.log('getServiceHost() creating request with options=' + JSON.stringify(options));
    console.log('getServiceHost() creating request  ' + options.method + 
                ' http://' + options.hostname + ':' + options.port + options.path);
    
    registryRequest.end();
    
}


function proxyRequest(clientRequest, clientResponse) {
    'use strict';
   console.log('proxyRequest() returning curried function');
  
    
    return function(host) {  
            console.log('proxyRequest() host=' + host);
          var requestUrl = url.parse(clientRequest.url, true, false);
           //var host = clientRequest.headers.host;

            var options = {
                method: clientRequest.method,
                hostname: host,
                port: endPointPort,
                path: requestUrl.path,
                headers: clientRequest.headers
            };

            _.extend(options.headers, {
                host: host,
                "x-forwarded-for": clientRequest.clientIp
            });

            var serviceRouteRequest = http.request(options, 
                                                _serviceResponseHandler(clientRequest, clientResponse, options, host, requestUrl));


           serviceRouteRequest.on(REQUEST_RESPONSE_EVENTS.ERROR, function (error) {
                console.log("handleRequest() on error");
                clientResponse.statusCode = BAD_GATEWAY_RESPONSE_CODE;
                clientResponse.end();
            });

            clientRequest.on(REQUEST_RESPONSE_EVENTS.DATA, function (data) {
                serviceRouteRequest.write(data);
            });

            clientRequest.on(REQUEST_RESPONSE_EVENTS.END, function () {
                serviceRouteRequest.end();
               console.log("end");
            });
        
    }

}

function _sendBadGateway(response) {
    'use strict';   
    response.statusCode = BAD_GATEWAY_RESPONSE_CODE;
    response.end();
}




function _serviceResponseHandler(clientRequest, clientResponse, options, host, requestUrl) {


   console.log("_serviceResponseHandler() host =" + host);

    return function (serviceRouteResponse) {

        clientResponse.statusCode = serviceRouteResponse.statusCode;

        _.each(serviceRouteResponse.headers, function (headerValue, headerKey) {
            clientResponse.setHeader(headerKey, headerValue);
        });

        serviceRouteResponse.on(REQUEST_RESPONSE_EVENTS.ERROR, function (error) {
            clientResponse.connection.destroy();

        });

        serviceRouteResponse.on(REQUEST_RESPONSE_EVENTS.DATA, function (chunk) {
            clientResponse.write(chunk);
        });

        serviceRouteResponse.on(REQUEST_RESPONSE_EVENTS.END, function () {
            clientResponse.end();

        });

        serviceRouteResponse.on(REQUEST_RESPONSE_EVENTS.CLOSE, function () {
            clientResponse.connection.destroy();
        });
    }

}
