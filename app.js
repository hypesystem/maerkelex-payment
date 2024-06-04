import express from "express";
import purchaseApp from "./purchase/app.js";
import adminApp from "./admin/app.js";
import canaryCheck from "./canary/app.js";
import bodyParser from "body-parser";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';
    
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const errorView = fs.readFileSync(path.join(__dirname, "_errors/default.html")).toString();
const badRequestErrorView = fs.readFileSync(path.join(__dirname, "_errors/400.html")).toString();
import mustache from "mustache";
import memoryStaticAssetMiddleware from "./memoryStaticAssetMiddleware/index.js";

export default (purchases, db, cookieSession, billy, maerkelex, stock, maerkelexBaseUrl) => {
    let app = express();

    app.use(bodyParser.urlencoded({
        extended: true,
    }));

    app.use(cookieSession);

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
    app.use("/admin", adminApp(db, purchases, billy, maerkelex, stock, maerkelexBaseUrl));
    app.use("/assets", memoryStaticAssetMiddleware(path.join(__dirname, "assets")));

    return app;
};
