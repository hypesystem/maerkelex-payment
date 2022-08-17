const fs = require("fs");
const path = require("path");
const mustache = require("mustache");
const overviewLayout = fs.readFileSync(path.join(__dirname, "..", "..", "overviewLayout.html"), "utf8");
const viewFragment = fs.readFileSync(path.join(__dirname, "view.html"), "utf8");
const view = mustache.render(overviewLayout, { content: viewFragment });

module.exports = (stock) => (req, res) => {
    stock.loadState()
        .then((badges) => {
            if(typeof req.query.json !== 'undefined') {
                return res.send(badges);
            }
            res.send(mustache.render(view, { badges }));
        })
        .catch((error) => {
            console.error("Something went wrong", error);
            res.fail(500, "Something went wrong");
        });
};
