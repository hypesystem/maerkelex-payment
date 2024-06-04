export default (purchases) => (req, res) => {
    purchases.markPosted(req.params.id, (error) => {
        if(error && error.type == "PurchaseNotFound") {
            return res.status(404).send({ error: "No purchase with that ID exists." })
        }
        if(error) {
            console.error("Failed to mark purchase as posted", {
                params: req.params,
                error
            });
            return res.status(500).send({ error: "Unexpected error, try again." });
        }

        res.send({});
    });
};