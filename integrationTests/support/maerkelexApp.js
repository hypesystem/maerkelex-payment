const express = require("express");

module.exports = () => {
    let app = express();

    let dataset = [];
    let defaultShippingPrice = 0;

    app.get("/m.json", (req, res) => {
        res.send({
            m: dataset,
            defaultShippingPrice: defaultShippingPrice
        });
    });

    app._addBadge = (badge) => dataset.push(badge);
    app._clearBadges = () => dataset = [];
    app._setDefaultShippingPrice = (price) => defaultShippingPrice = price;

    return app;
};
