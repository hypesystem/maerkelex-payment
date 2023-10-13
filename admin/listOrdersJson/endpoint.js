module.exports = (purchases, maerkelex) => (req, res) => {
    purchases.list((error, orders) => {
        if(error) {
            console.error("Failed to list purchases", error);
            return res.status(500).send({ error: "failed to list orders" });
        }
        maerkelex.getData((error, maerkeData) => {
            if(error) {
                console.error("Failed to list purchase", error);
                res.status(500).send({error: "Failed to list orders"});
                return; 
            }
            let result = orders
                .filter(order => order.status == "completed" || order.status == "dispatched")
                .sort((a, b) => a.data.completedAt < b.data.completedAt ? 1 : (a.data.completedAt > b.data.completedAt ? -1 : 0))
                .map(order => {
                    const viewModel = order.data.viewModel;
                    let customerInfo = {};
                    if(viewModel.customerInfo) {
                        customerInfo.email = viewModel.customerInfo.email;
                        customerInfo.phoneNumber = viewModel.customerInfo.phoneNumber;

                        if(viewModel.customerInfo.name && viewModel.customerInfo.invoicingAddress) {
                            customerInfo.customer = viewModel.customerInfo.name + ", " + viewModel.customerInfo.invoicingAddress.city;
                        }
                        if(viewModel.customerInfo.deliveryAddress) {
                            customerInfo.address = stringifyAddress(viewModel.customerInfo.deliveryAddress);
                        }
                    }

                    return {
                        id: order.id,
                        date: prettifyDate(order.data.completedAt),
                        isPreorder: order.data.isPreorder || false,
                        statusChangeDate: prettifyDate(selectLatestStateDate(order.data)),
                        ...customerInfo,
                        status: translateOrderStatus(order.status),
                        description: describeOrder(viewModel.orderLines),
                        total: order.data.total,
                        items: viewModel.orderLines.map((orderLine) => {
                            if(orderLine.id) {
                                orderLine.name = maerkeData.m.find((m) => m.id === orderLine.id)?.name;
                            }
                            return orderLine;
                        }),
                    };
                });
            res.send(result);
        });
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
    return [ address.name, address.address, address.postalCode + " " + address.city, address.country ].join("\n");
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
