const express = require("express");
const formViewEndpoint = require("./formView/endpoint");
const submitEndpoint = require("./submit/endpoint");

module.exports = (users) => {
    let app = express();

    app.get("/", formViewEndpoint());
    app.post("/", submitEndpoint(users));

    return app;
};
