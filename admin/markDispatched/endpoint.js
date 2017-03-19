module.exports = (purchases) => (req, res) => {
    purchases.sendReceipt(req.params.id, (error) => {
        if(error && error.type == "PurchaseNotFound") {
            return res.send(400, "Ordren findes ikke.");
        }
        if(error && error.type == "CanNotDispatchPurchase") {
            return res.send(400, "Ordren kan ikke markeres som afsendt (enten allerede afsendt eller endnu ikke betalt).");
        }
        if(error) {
            console.error("Failed to send receipt for purchase", error);
            return res.fail(500);
        }
        res.redirect("/admin");
    });
};
