export default (purchases) => (req, res) => {
    if(!req.params || !req.params.id) {
        return res.fail(400, "Mangler ID for kvittering du vil se.");
    }
    purchases.getHtmlReceipt(req.params.id, (error, receipt) => {
        if(error && error.type == "PurchaseNotFound") {
            console.error("User attempted to see receipt for order does not exist: " + req.params.id);
            return res.fail(400, "Det angivne ID svarer ikke til en ordre.");
        }
        if(error && error.type == "NoReceiptForPurchaseExists") {
            console.error("User attempted to see receipt for order not yet dispatched: " + req.params.id);
            return res.fail(400, "Ordren har endnu ikke en kvittering, da den ikke er markeret som afsendt.");
        }
        if(error) {
            console.error(`Failed to get HTML receipt for ${req.params.id}`, error);
            return res.fail(500);
        }
        res.send(`
            <!DOCTYPE html>
            <html>
                <head>
                    <meta charset="utf8">
                    <title>Kvittering | Mærkelex</title>
                </head>
                <body>
                    ${receipt}
                </body>
            </html>
        `);
    });
};
