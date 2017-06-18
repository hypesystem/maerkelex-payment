const fs = require("fs");
const path = require("path");
const async = require("async");
const mime = require("mime");

module.exports = (folder) => {
    let state = {};
    let ready = false;
    let queue = [];
    indexFiles(folder, "", state, (error) => {
        if(error) {
            console.error("[memory-static-asset-middleware] Failed to index files for memory static asset middleware", error);
        }
        ready = true;
        queue.forEach(handler => handler());
        console.log("[memory-static-asset-middleware] Loaded the following files into memory:\n\t+ " + Object.keys(state).join("\n\t+ "));
    });
    return function(req, res, next) {
        if(ready) {
            handle(state, req, res, next);
        }
        else {
            queue.push(() => handle(state, req, res, next));
        }
    };
};

function indexFiles(root, sub, state, callback) {
    let currentDirPath = path.join(root, sub);
    fs.readdir(currentDirPath, (error, files) => {
        if(error && error.code == "ENOTDIR") {
            return loadFile(currentDirPath, sub, state, callback);
        }
        if(error) {
            return callback(error);
        }
        async.each(files, (file, callback) => indexFiles(root, sub + "/" + file, state, callback), callback);
    });
}

function loadFile(currentDirPath, sub, state, callback) {
    fs.readFile(currentDirPath, (error, content) => {
        if(error) {
            return callback(error);
        }
        state[sub] = (req, res) => res.set("Content-Type", mime.lookup(currentDirPath)).send(content);
        callback();
    });
}

function handle(state, req, res, next) {
    if(state[req.path]) {
        state[req.path](req, res);
    }
    next();
}
