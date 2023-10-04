module.exports = (purchases) => (req, res) => {
    const options = req.query;
    purchases.sendReceipt(req.params.id, (error) => {
        if(error && error.type == "PurchaseNotFound") {
            return res.fail(400, "Ordren findes ikke.");
        }
        if(error && error.type == "CanNotDispatchPurchase") {
            return res.fail(400, "Ordren kan ikke markeres som afsendt (enten allerede afsendt eller endnu ikke betalt).");
        }
        if(error) {
            console.error("Failed to send receipt for purchase", error);
            return res.fail(500, "Kunne ikke sende en kvitering for ordren");
        }
        if(options && options.redirectToAdmin == "false") {
            return res.status(200).send("Ordren blev markeret som afsendt");
        }
        res.redirect("/admin");
    });
};
