import fs from "fs";
import path from "path";
import mustache from "mustache";
import { fileURLToPath } from 'url';
    
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const overviewLayout = fs.readFileSync(path.join(__dirname, "..", "overviewLayout.html"), "utf8");
const listViewFragment = fs.readFileSync(path.join(__dirname, "listView.html"), "utf8");
const listView = mustache.render(overviewLayout, { content: listViewFragment });

export default (purchases, maerkelex, maerkelexBaseUrl) => (req, res) => {
    const getOrdersPromise = new Promise((resolve, reject) => purchases.list((error, orders) => {
        if(error) {
            return reject(error);
        }
        resolve(orders.filter(x => x.status == "completed" || x.status == "dispatched"));
    }));

    Promise.all([
        maerkelex.getDataAsync().then((data) => data.m.filter((badge) => badge.price)),
        getOrdersPromise,
    ]).then(([ badgesForSale, orders ]) => {
        let badgesSold = orders.map(x => {
            return x.data.viewModel.orderLines
                .map(y => parseFloat(y.count) || 0)
                .reduce((acc, val) => acc + val, 0);
        }).reduce((acc, val) => acc + val, 0);

        let income = orders
            .map(x => parseFloat(x.data.total || 0))
            .reduce((acc, val) => acc + val, 0);

        let profit = income * 0.8 * 0.95 - (orders.length * 3); //20% MOMS, 5% Mærkelex fee, 3kr Mærkelex fee pr transaction

        res.send(mustache.render(listView, {
            badgesSold: badgesSold,
            income: Math.round(income),
            profit: Math.round(profit),
            remainder: Math.round(profit),
            badgesForSale,
            maerkelexBaseUrl,
        }));
    }).catch((error) => {
        console.error("Failed to list purchase", error);
        res.fail(500);
    });
};
