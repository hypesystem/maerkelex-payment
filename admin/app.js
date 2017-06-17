const express = require("express");
const Users = require("../users/index");
const authenticate = require("./authenticateMiddleware");
const listPurchasesEndpoint = require("./listPurchases/endpoint");
const listOrdersJsonEndpoint = require("./listOrdersJson/endpoint");
const markDispatchedEndpoint = require("./markDispatched/endpoint");
const loginApp = require("./login/app");
const changePasswordEndpoint = require("./change-password/endpoint");

module.exports = (db, purchases) => {
    let app = express();

    let users = Users(db);

    app.get("/", authenticate(users), listPurchasesEndpoint(purchases));
    app.get("/orders", authenticate(users), listOrdersJsonEndpoint(purchases));
    app.get("/orders/:id/mark-dispatched", authenticate(users), markDispatchedEndpoint(purchases));
    app.post("/change-password", authenticate(users), changePasswordEndpoint(users));
    app.use("/login", loginApp(users));

    return app;
};
