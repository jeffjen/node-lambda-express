"use strict"

const express = require("express");
const http = require("http");
const util = require("util");

// NOTE: An express.request is an augmented http.IncomingMessage
// Internally http.IncommingMessage is a ReadableStream created by http.Server

// Patch http.IncomingMessage _read interface to replace data source
express.request._read = function _read(size) {
    size = size || this._internalData.length;
    // splice a piece of data from current position to size
    let s = this._internalData.slice(this._ptr, size);
    if (s) {
        this._ptr = this._ptr + size;
        this.push(s);
    } else {
        this.push(null);
    }
}

const request = module.exports.request = function request(event) {
    http.IncomingMessage.call(this);

    // Original request data
    this.method = event.method;
    this.url = event.url;
    this.headers = event.headers;

    // Pending content body for middleware data source
    this._internalData = event.body;
    this._ptr = 0;
    this.headers['content-length'] = this._internalData.length;

    // http protocol info
    this.httpVersion = "1.1";
    this.httpVersionMajor = 1;
    this.httpVersionMinor = 1;

    // Client address initiated this request
    this.connection = {
        remoteAddress: event.remoteAddress || "127.0.0.1"
    }
}
util.inherits(request, http.IncomingMessage);

// NOTE: An express.response is an augmented http.ServerResponse
// Internally http.ServerResponse is a Stream created by http.Server

express.response.end = function end(data, encoding, callback) {
    // Trigger other middleware to log end of handling
    this._implicitHeader();
    // Tell the pipeline I am done
    this.emit("finish");
    let res = { statusCode: this.statusCode, headers: this._headers, body: data.toString() };
    if (this.statusCode === 200) {
        // Invoke attached AWS Lambda handler callback
        this.callback(null, res);
    } else {
        // Invoke attached AWS Lambda handler error callback
        this.callback(JSON.stringify(res), null);
    }
}

const response = module.exports.response = function response(req, callback) {
    http.ServerResponse.call(this, req);
    this.callback = callback;
}
util.inherits(response, http.ServerResponse);
