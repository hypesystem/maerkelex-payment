const fs = require("fs");
const path = require("path");
const mustache = require("mustache");
const overviewLayout = fs.readFileSync(path.join(__dirname, "..", "..", "overviewLayout.html"), "utf8");
const viewFragment = fs.readFileSync(path.join(__dirname, "view.html"), "utf8");
const view = mustache.render(overviewLayout, { content: viewFragment });

module.exports = (maerkelex) => (req, res) => {
    maerkelex.getData((error, data) => {
        if(error) {
            console.error("Something went wrong", error);
            return res.fail(500, "Something went wrong");
        }
        const badges = data.m
            .filter((badge) => badge.price || badge.price == 0)
            .map((badge) => {
                badge.pricePretty = badge.price.toFixed(2);
                badge.priceNoVat = badge.price * 0.8;
                badge.priceNoVatPretty = badge.priceNoVat.toFixed(2);
                return badge;
            });
        res.send(mustache.render(view, { badges }));
    });
};
