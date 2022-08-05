module.exports = (purchases) => (req, res) => {
    const { email, address, phoneNumber, status } = req.body;

    purchases.get(req.params.id, (error, purchase) => {
        if(error) {
            console.error("Failed to get purchase", error);
            return res.status(500).send({ error: "failed to get order" });
        }

        if(!address && !email && !phoneNumber && !status) {
            return res.status(400).send({ error: "Missing argument, must include `address`, `email`, `phoneNumber`, or `status`" });
        }

        if(address) {
            if(address.split("\n").length < 3) {
                return res.status(400).send({ error: "Too few lines in addess" });
            }

            const addressLines = address.split("\n");
            const cityMatch = addressLines[2].match(/^([0-9]{4}) (.+)$/);

            if(!cityMatch) {
                return res.status(400).send({ error: "Malformed city/postal code line" });
            }

            const [ _, postalCode, city ] = cityMatch;

            purchase.data.viewModel.customerInfo.deliveryAddress.name = addressLines[0];
            purchase.data.viewModel.customerInfo.deliveryAddress.address = addressLines[1];
            purchase.data.viewModel.customerInfo.deliveryAddress.postalCode = postalCode;
            purchase.data.viewModel.customerInfo.deliveryAddress.city = city;
        }

        if(email) {
            if(!(/^.+@.+$/.test(email))) {
                return res.status(400).send({ error: "Invalid email" });
            }

            purchase.data.viewModel.customerInfo.email = email;
        }

        if(phoneNumber) {
            if(phoneNumber.length < 8) {
                return res.status(400).send({ error: "Phone number too short" });
            }

            purchase.data.viewModel.customerInfo.phoneNumber = phoneNumber;
        }

        if(status) {
            if(![ "completed", "dispatched", "failed" ].includes(status)) {
                return res.status(400).send({ error: "Invalid status, can only set to 'completed', 'dispatched' or 'failed'."});
            }

            purchase.status = status;
        }

        purchases.update(purchase, (error) => {
            if(error) {
                console.error("Failed to update purchase", error);
                return res.status(500).send({ error: "Unexpected error" });
            }
            console.log("updated purchase", {
                customerInfo: purchase.data.viewModel.customerInfo,
                status: purchase.status
            });
            res.send({});
        });
    });
};
