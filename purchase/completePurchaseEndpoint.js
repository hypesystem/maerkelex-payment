var mustache = require("mustache");
var fs = require("fs");
var path = require("path");
var completeView = fs.readFileSync(path.join(__dirname, "completeView.html")).toString();

module.exports = (purchases) => (req, res) => {
    var purchaseId = req.body["order_number"];
    var paymentMethodNonce = req.body["payment_method_nonce"];
    if(!purchaseId || !paymentMethodNonce) {
        console.error("Error in submission to payment completion endpoint: missing purchase id or nonce.", purchaseId, paymentMethodNonce);
        return res.fail(400, "Der var noget galt med formularen, prøv igen.");
    }
    purchases.complete(purchaseId, paymentMethodNonce, (error) => {
        if(error && error.type == "PurchaseNotFound") {
            console.error("Someone tried to complete a purchase not found", error);
            return res.fail(400, "Der er noget galt med forespørgslen. Start dit køb forfra.");
        }
        if(error && error.type == "PurchaseInvalidState") {
            return res.fail(400, "Der er noget galt med forespørgslen. Start det køb forfra.");
        }
        if(error && error.type == "InvalidPaymentInformation") {
            return res.fail(400, "Dine kortoplysninger var ikke gyldige.");
        }
        if(error) {
            console.error("Failed to complete purchase", error);
            return res.fail(500, req.body);
        }
        res.send(completeView);
    });
};
