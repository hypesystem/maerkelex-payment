const fs = require("fs");
const path = require("path");
const view = fs.readFileSync(path.join(__dirname, "view.html")).toString();
const mustache = require("mustache");

module.exports = (purchases) => (req, res) => {
    purchases.list((error, orders) => {
        if(error) {
            console.error("Failed to list purchase", error);
            return res.fail(500);
        }

        let unaccountedOrders = orders
            .filter(x => x.data.dispatchedAt && !x.data.postedToAccounting)
            .sort((a, b) => {
                if(a.data.dispatchedAt < b.data.dispatchedAt) {
                    return -1;
                }
                if(a.data.dispatchedAt > b.data.dispatchedAt) {
                    return 1;
                }
                return 0;
            })
            .map((o) => {
                return {
                    id: o.id,
                    paidAt: prettifyDate(o.data.dispatchedAt),
                    description: `${o.data.viewModel.customerInfo.name}<br>${o.data.viewModel.orderLines.map((l) => l.description).join("; ")}<br>${o.data.total} DKK`
                };
            });

        let accountedOrders = orders.filter(x => x.data.postedToAccounting);
        let autoAccountedOrderCount = accountedOrders.filter(x => x.data.autoAccounted).length;
        let manuallyAccountedOrdercount = accountedOrders.length - autoAccountedOrderCount;

        let viewModel = {
            unaccountedOrders,
            autoAccountedOrderCount,
            manuallyAccountedOrdercount,
        };

        res.send(mustache.render(view, viewModel));
    });
};

function prettifyDate(date) {
    if(!date) return "";
    let parts = date.substring(0, 10).split("-");
    return parts[2] + "/" + parts[1] + " " + parts[0];
}
