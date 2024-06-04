import express from "express";
import startPurchaseEndpoint from "./startPurchaseEndpoint.js";
import completePurchaseEndpoint from "./completePurchaseEndpoint.js";
import logPurchaseErrorEndpoint from "./logPurchaseErrorEndpoint.js";

export default (purchases) => {
    let app = express();

    app.post("/", startPurchaseEndpoint(purchases));
    app.post("/complete", completePurchaseEndpoint(purchases));
    app.post("/log-purchase-error", express.json(), logPurchaseErrorEndpoint(purchases));
    
    return app;
};
