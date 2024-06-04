import express from "express";
import formViewEndpoint from "./formView/endpoint.js";
import submitEndpoint from "./submit/endpoint.js";

export default (users) => {
    let app = express();

    app.get("/", formViewEndpoint());
    app.post("/", submitEndpoint(users));

    return app;
};
