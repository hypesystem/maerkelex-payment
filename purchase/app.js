const express = require("express");
const startPurchaseEndpoint = require("./startPurchaseEndpoint.js");
const completePurchaseEndpoint = require("./completePurchaseEndpoint.js");
const logPurchaseErrorEndpoint = require("./logPurchaseErrorEndpoint.js");

module.exports = (purchases) => {
    let app = express();

    app.post("/", startPurchaseEndpoint(purchases));
    app.post("/complete", completePurchaseEndpoint(purchases));
    app.post("/log-purchase-error", express.json(), logPurchaseErrorEndpoint(purchases));
    
    return app;
};
