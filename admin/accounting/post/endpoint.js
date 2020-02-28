module.exports = (billy) => (req, res) => {
    let { id } = req.params;

    billy.createOrderTransaction(id, (error) => {
        if(error && error.type == "PurchaseNotFound") {
            return res.status(404).send({ error: "Purchase not found." });
        }
        if(error) {
            console.error("Failed to create order", {
                params: req.params,
                error
            });
            return res.status(500).send({ error: "Unexpected error posting to accounting system." });
        }

        res.send({});
    });
};
