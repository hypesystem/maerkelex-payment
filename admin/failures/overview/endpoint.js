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
                let aLatestTimestamp, bLatestTimestamp;

                if(!a.data.errors || !a.data.errors.length){
                    aLatestTimestamp = a.data.viewModel.date;
                }else{
                    aLatestTimestamp = a.data.errors[a.data.errors.length - 1].at;
                }

                if(!b.data.errors || !b.data.errors.length){
                    bLatestTimestamp = b.data.viewModel.date
                }else{
                    bLatestTimestamp = b.data.errors[b.data.errors.length - 1].at;
                }

                if(aLatestTimestamp < bLatestTimestamp) {
                    return 1;
                }
                if(aLatestTimestamp > bLatestTimestamp) {
                    return -1;
                }
                return 0;
            })
            .map((o) => {
                const latestError = o.data.errors && o.data.errors.length && o.data.errors[o.data.errors.length - 1];
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

function prettifyDate(date) {
    if(!date) return "";
    let parts = date.substring(0, 10).split("-");
    return parts[2] + "/" + parts[1] + " " + parts[0];
}
