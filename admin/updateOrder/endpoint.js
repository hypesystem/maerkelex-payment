module.exports = (purchases) => (req, res) => {
    const { email, address, phoneNumber } = req.body;

    purchases.get(req.params.id, (error, purchase) => {
        if(error) {
            console.error("Failed to get purchase", error);
            return res.status(500).send({ error: "failed to get order" });
        }

        if(!address || !email || !phoneNumber) {
            return res.status(400).send({ error: "Missing argument, must include `address`, `email` and `phoneNumber`" });
        }

        if(address.split("\n").length != 3) {
            return res.status(400).send({ error: "Too few lines in addess" });
        }

        if(!(/^.+@.+$/.test(email))) {
            return res.status(400).send({ error: "Invalid email" });
        }

        if(phoneNumber.length < 8) {
            return res.status(400).send({ error: "Phone number too short" });
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
        purchase.data.viewModel.customerInfo.email = email;
        purchase.data.viewModel.customerInfo.phoneNumber = phoneNumber;

        purchases.update(purchase, (error) => {
            if(error) {
                console.error("Failed to update purchase", error);
                return res.status(500).send({ error: "Unexpected error" });
            }
            console.log("updated", purchase.data.viewModel.customerInfo);
            res.send({});
        });
    });
};
