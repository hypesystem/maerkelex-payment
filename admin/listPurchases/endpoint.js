const fs = require("fs");
const path = require("path");
const listView = fs.readFileSync(path.join(__dirname, "listView.html")).toString();
const mustache = require("mustache");

module.exports = (purchases) => (req, res) => {
    purchases.list((error, orders) => {
        if(error) {
            console.error("Failed to list purchase", error);
            return res.fail(500);
        }
        orders = orders.filter(x => x.status == "completed" || x.status == "dispatched");
        let badgesSold = orders.map(x =>
                            x.data.viewModel.orderLines
                            .map(y => parseFloat(y.count) || 0)
                            .reduce((acc, val) => acc + val, 0)
                        ).reduce((acc, val) => acc + val, 0);
        let income = orders
                        .map(x => parseFloat(x.data.total || 0))
                        .reduce((acc, val) => acc + val, 0);
        let profit = income * 0.8 * 0.9; //20% MOMS, 10% Mærkelex fee
        let viewModel = {
            badgesSold: badgesSold,
            income: Math.round(income),
            profit: Math.round(profit),
            remainder: Math.round(profit)
        };
        res.send(mustache.render(listView, viewModel));
    });
};
