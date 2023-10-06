const fs = require("fs");
const path = require("path");
const mustache = require("mustache");
const overviewLayout = fs.readFileSync(path.join(__dirname, "..", "..", "overviewLayout.html"), "utf8");
const viewFragment = fs.readFileSync(path.join(__dirname, "view.html"), "utf8");
const view = mustache.render(overviewLayout, { content: viewFragment });


module.exports = (purchases) => (req, res) => {
    purchases.list((error, orders) => {
        if(error) {
            console.error("Failed to list purchase", error);
            return res.fail(500);
        }

        let failedOrders = orders
            .filter(x => x.status == "failed" || (x.data.errors && x.data.errors.length))
            .sort((a, b) => {
                const aLatestTimestamp = getLatestTimestamp(a);
                const bLatestTimestamp = getLatestTimestamp(b);

                if(aLatestTimestamp < bLatestTimestamp) {
                    return 1;
                }
                if(aLatestTimestamp > bLatestTimestamp) {
                    return -1;
                }
                return 0;
            })
            .map((o) => {
                const latestError = getLastElement(o.data.errors);
                const latestErrorAt = latestError ? prettifyDate(latestError.at) : prettifyDate(o.data.viewModel.date);
                return {
                    id: o.id,
                    latestErrorAt,
                    errors: !latestError ? [] : o.data.errors.reverse().map((error) => {
                        return {
                            at: prettifyDate(error.at),
                            data: error.data && JSON.stringify(error.data, null, 4),
                            description: error.description,
                        };
                    }),
                    description: `${o.data.viewModel.customerInfo.name}<br>${o.data.viewModel.orderLines.map((l) => l.description).join("; ")}<br>${o.data.total} DKK`,
                    viewModel: JSON.stringify(o.data.viewModel, null, 4),
                };
            });

        res.send(mustache.render(view, { failedOrders }));
    });
};

function getLatestTimestamp(order){
    if(!order.data.errors || !order.data.errors.length){
        return order.data.viewModel.date;
    }
    return order.data.errors[order.data.errors.length - 1].at;
}

function getLastElement(list) {
    if(!list || !list.length) {
        return undefined;
    }
    return list[list.length - 1];
}

function prettifyDate(date) {
    if(!date) return "";
    let parts = date.substring(0, 10).split("-");
    return parts[2] + "/" + parts[1] + " " + parts[0];
}
