module.exports = (purchases) => (req, res) => {
    const { orderNumber, threeDSecureData, error: purchaseError } = req.body;
    
    if(!orderNumber || !purchaseError) {
        console.error("Error in logging statement: missing order number or error.", { orderNumber, threeDSecureData, purchaseError });
        return res.status(400).send({ error: "Missing orderNumber or error" });
    }

    purchases.get(orderNumber, (error, purchase) => {
        if(error) {
            console.error("Failed to get orderby orderNumber to log error", { orderNumber, purchaseError, threeDSecureData });
            return res.status(500).send({ error: "Failed to log error" });
        }

        if(!purchase.data.errors) {
            purchase.data.errors = [];
        }

        purchase.data.errors.push({
            at: (new Date).toISOString(),
            data: threeDSecureData,
            description: purchaseError,
        });

        purchases.update(purchase, (error) => {
            if(error) {
                console.error("Failed to update purchase with new error", purchase);
                return res.status(500).send({ error: "Failed to log error" });
            }

            res.send();
        });
    });
};
