http = require('http');
var url = require('url');
var _ = require('underscore');



var port = process.env.SP_PROXY_PORT || 80;
var BAD_GATEWAY_RESPONSE_CODE = 502;
var X_FORWARDED_FOR_HEADER = 'x-forwarded-for';
var endPointPort = 80;

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
    'use strict';

  var requestUrl = url.parse(clientRequest.url, true, false);
   var host = clientRequest.headers.host;

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

    var serviceRouteRequest = http.request(options, _serviceResponseHandler(clientRequest, clientResponse, options, host, requestUrl));

    
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
