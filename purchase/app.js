const express = require("express");
const startPurchaseEndpoint = require("./startPurchaseEndpoint.js");
const completePurchaseEndpoint = require("./completePurchaseEndpoint.js");

module.exports = (purchases) => {
    let app = express();

    app.post("/", startPurchaseEndpoint(purchases));
    app.post("/complete", completePurchaseEndpoint(purchases));
    
    return app;
};
