module.exports = (purchases) => (req, res) => {
    purchases.createManualReceipt(req.body, (error, result) => {
        if(error) {
            console.error("Something went wrong", error);
            return res.fail(500, "Something went wrong");
        }

        res.redirect(`/admin/orders/${result.paymentId}/receipt`);
    });
};
