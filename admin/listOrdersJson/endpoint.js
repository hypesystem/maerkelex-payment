module.exports = (purchases) => (req, res) => {
    purchases.list((error, orders) => {
        if(error) {
            console.error("Failed to list purchases", error);
            return res.status(500).send({ error: "failed to list orders" });
        }
        let result = orders
            .filter(order => order.status == "completed" || order.status == "dispatched")
            .sort((a, b) => a.data.completedAt < b.data.completedAt ? 1 : (a.data.completedAt > b.data.completedAt ? -1 : 0))
            .map(order => {
                let viewModel = order.data.viewModel;
                return {
                    id: order.id,
                    date: prettifyDate(order.data.completedAt),
                    isPreorder: order.data.isPreorder || false,
                    statusChangeDate: prettifyDate(selectLatestStateDate(order.data)),
                    customer: viewModel.customerInfo.name + ", " + viewModel.customerInfo.invoicingAddress.city,
                    address: stringifyAddress(viewModel.customerInfo.deliveryAddress),
                    email: viewModel.customerInfo.email,
                    phoneNumber: viewModel.customerInfo.phoneNumber,
                    status: translateOrderStatus(order.status),
                    description: describeOrder(viewModel.orderLines),
                    total: order.data.total
                };
            });
        res.send(result);
    });
};

function prettifyDate(date) {
    if(!date) return "";
    let parts = date.substring(0, 10).split("-");
    return parts[2] + "/" + parts[1] + " " + parts[0];
}

function selectLatestStateDate(data) {
    return data.dispatchedAt || data.completedAt;
}

function stringifyAddress(address) {
    return [ address.name, address.address, address.postalCode + " " + address.city ].join("\n");
}

function translateOrderStatus(status) {
    switch(status) {
        case "completed":
            return "pending";
        case "dispatched":
            return "dispatched";
        default:
            return "error";
    }
}

function describeOrder(orderLines) {
    return orderLines.map(x => x.description).join(" + ");
}
