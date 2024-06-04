import express from "express";
import Users from "../users/index.js";
import authenticate from "./authenticateMiddleware.js";
import listPurchasesEndpoint from "./listPurchases/endpoint.js";
import listOrdersJsonEndpoint from "./listOrdersJson/endpoint.js";
import markDispatchedEndpoint from "./markDispatched/endpoint.js";
import viewReceiptEndpoint from "./viewReceipt/endpoint.js";
import accountingOverviewEndpoint from "./accounting/overview/endpoint.js";
import failedOrdersOverviewEndpoint from "./failures/overview/endpoint.js";
import markOrderPostedEndpoint from "./accounting/mark-posted/endpoint.js";
import postOrderToAccountingEndpoint from "./accounting/post/endpoint.js";
import loginApp from "./login/app.js";
import changePasswordEndpoint from "./change-password/endpoint.js";
import updateOrderInfoEndpoint from "./updateOrder/endpoint.js";
import inputManualReceiptEndpoint from "./manual-receipt/input-endpoint.js";
import createManualReceiptEndpoint from "./manual-receipt/create-endpoint.js";
import viewStockEndpoint from "./accounting/stock/viewEndpoint.js";
import saveStockEndpoint from "./accounting/stock/saveEndpoint.js";

export default (db, purchases, billy, maerkelex, stock, maerkelexBaseUrl) => {
    let app = express();

    let users = Users(db);

    app.get("/", authenticate(users), listPurchasesEndpoint(purchases, maerkelex, maerkelexBaseUrl));

    app.get("/manual-receipt", authenticate(users), inputManualReceiptEndpoint(maerkelex));
    app.post("/manual-receipt", authenticate(users), createManualReceiptEndpoint(purchases));

    app.get("/orders", authenticate(users), listOrdersJsonEndpoint(purchases, maerkelex));
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
