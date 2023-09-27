module.exports = (purchases) => (req, res) => {
    const options = req.query;
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
        if(options && options.redirectToAdmin == "false") {
            return res.send(200, "Ordren blev markeret som afsendt");
        }
        res.redirect("/admin");
    });
};
