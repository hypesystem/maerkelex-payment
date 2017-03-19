const express = require("express");
const Purchases = require("./purchases/index");
const purchaseApp = require("./purchase/app");
const adminApp = require("./admin/app");
var bodyParser = require("body-parser");
var fs = require("fs");
var path = require("path");
var errorView = fs.readFileSync(path.join(__dirname, "_errors/default.html")).toString();
var badRequestErrorView = fs.readFileSync(path.join(__dirname, "_errors/400.html")).toString();
var mustache = require("mustache");

module.exports = (maerkelex, paymentGateway, db, mailer) => {
    var app = express();

    let purchases = Purchases(maerkelex, paymentGateway, db, mailer);
    
    app.use(bodyParser.urlencoded());
    
    app.use((req, res, next) => {
        res.fail = (statusCode, message, failedAction) => {
            if(typeof message !== "string") {
                failedAction = message;
                message = null;
            }
            var viewModel = { content: message };
            if(failedAction) {
                var fields = [];
                Object.keys(failedAction).forEach((key) => {
                    fields.push({
                        key: key,
                        value: failedAction[key]
                    });
                });
                viewModel.retryAction = {
                    method: req.method,
                    action: req.baseUrl,
                    fields: fields
                };
            }
            var result;
            if(statusCode == 400) {
                result = mustache.render(badRequestErrorView, viewModel);
            }
            else {
                result = mustache.render(errorView, viewModel);
            }
            return res.status(statusCode).send(result);
        };
        next();
    });

    app.use("/", purchaseApp(purchases));
    app.use("/admin", adminApp(db, purchases));

    return app;
};
