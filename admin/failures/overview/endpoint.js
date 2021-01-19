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

        let failedOrders = orders
            .filter(x => x.status == "failed" || (x.data.errors && x.data.errors.length))
            .sort((a, b) => {
                if(!a.data.errors || !a.data.errors.length) {
                    return -1;
                }
                if(!b.data.errors || !b.data.errors.length) {
                    return 1;
                }

                const aLatest = a.data.errors[a.data.errors.length - 1];
                const bLatest = b.data.errors[b.data.errors.length - 1];
                if(aLatest < bLatest) {
                    return -1;
                }
                if(aLatest > bLatest) {
                    return 1;
                }
                return 0;
            })
            .map((o) => {
                const latestError = o.data.errors && o.data.errors.length && o.data.errors[o.data.errors.length - 1];
                return {
                    id: o.id,
                    latestErrorAt: latestError && prettifyDate(latestError.at),
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

function prettifyDate(date) {
    if(!date) return "";
    let parts = date.substring(0, 10).split("-");
    return parts[2] + "/" + parts[1] + " " + parts[0];
}
