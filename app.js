const express = require("express");
const Purchases = require("./purchases/index");
const purchaseApp = require("./purchase/app");
const adminApp = require("./admin/app");
const canaryCheck = require("./canary/app");
const bodyParser = require("body-parser");
const fs = require("fs");
const path = require("path");
const errorView = fs.readFileSync(path.join(__dirname, "_errors/default.html")).toString();
const badRequestErrorView = fs.readFileSync(path.join(__dirname, "_errors/400.html")).toString();
const mustache = require("mustache");
const cookieSession = require("cookie-session");

module.exports = (maerkelex, paymentGateway, db, mailer) => {
    let app = express();

    let purchases = Purchases(maerkelex, paymentGateway, db, mailer);
    
    app.use(bodyParser.urlencoded({
        extended: false
    }));

    app.use(cookieSession({
        name: "maerkelex-payment-session-cookie",
        secret: "abb304c8-4b8e-4668-a744-451770259de0"
    }));
    
    app.use((req, res, next) => {
        res.fail = (statusCode, message, failedAction) => {
            if(typeof message !== "string") {
                failedAction = message;
                message = null;
            }
            let viewModel = { content: message };
            if(failedAction) {
                let fields = [];
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
            let result;
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

    app.use("/canary", canaryCheck(db));

    app.use("/", purchaseApp(purchases));
    app.get("/", (req, res) => res.redirect("/admin"));
    app.use("/admin", adminApp(db, purchases));

    return app;
};
