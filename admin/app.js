const express = require("express");
const Users = require("../users/index");
const authenticate = require("./authenticateMiddleware");
const listPurchasesEndpoint = require("./listPurchases/endpoint");
const listOrdersJsonEndpoint = require("./listOrdersJson/endpoint");
const markDispatchedEndpoint = require("./markDispatched/endpoint");
const viewReceiptEndpoint = require("./viewReceipt/endpoint");
const accountingOverviewEndpoint = require("./accounting/overview/endpoint");
const failedOrdersOverviewEndpoint = require("./failures/overview/endpoint");
const markOrderPostedEndpoint = require("./accounting/mark-posted/endpoint");
const postOrderToAccountingEndpoint = require("./accounting/post/endpoint");
const loginApp = require("./login/app");
const changePasswordEndpoint = require("./change-password/endpoint");
const updateOrderInfoEndpoint = require("./updateOrder/endpoint");
const inputManualReceiptEndpoint = require("./manual-receipt/input-endpoint");
const createManualReceiptEndpoint = require("./manual-receipt/create-endpoint");
const viewStockEndpoint = require("./accounting/stock/viewEndpoint");
const saveStockEndpoint = require("./accounting/stock/saveEndpoint");

module.exports = (db, purchases, billy, maerkelex, stock, maerkelexBaseUrl) => {
    let app = express();

    let users = Users(db);

    app.get("/", authenticate(users), listPurchasesEndpoint(purchases, maerkelex, maerkelexBaseUrl));

    app.get("/manual-receipt", authenticate(users), inputManualReceiptEndpoint(maerkelex));
    app.post("/manual-receipt", authenticate(users), createManualReceiptEndpoint(purchases));

    app.get("/orders", authenticate(users), listOrdersJsonEndpoint(purchases));
    app.get("/orders/:id/mark-dispatched", authenticate(users), markDispatchedEndpoint(purchases));
    app.get("/orders/:id/receipt", authenticate(users), viewReceiptEndpoint(purchases));
    app.get("/accounting", authenticate(users), accountingOverviewEndpoint(purchases));
    app.get("/failures", authenticate(users), failedOrdersOverviewEndpoint(purchases));
    app.put("/orders/:id", authenticate(users), express.json(), updateOrderInfoEndpoint(purchases));
    app.post("/orders/:id/mark-posted", authenticate(users), markOrderPostedEndpoint(purchases));
    app.post("/orders/:id/post", authenticate(users), postOrderToAccountingEndpoint(billy));
    app.post("/change-password", authenticate(users), changePasswordEndpoint(users));

    app.get("/accounting/stock", authenticate(users), viewStockEndpoint(stock));
    app.post("/accounting/stock", authenticate(users), express.json(), saveStockEndpoint(stock));

    app.use("/login", loginApp(users));

    return app;
};
