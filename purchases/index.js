const uuid = require("uuid");
const mustache = require("mustache");
const fs = require("fs");
const path = require("path");
const emailLayout = fs.readFileSync(path.join(__dirname, "email-layout.html")).toString();
const bareOrderConfirmationEmailView = fs.readFileSync(path.join(__dirname, "order-confirmation-email.html")).toString();
const orderConfirmationEmailLayout = mustache.render(emailLayout, { content: bareOrderConfirmationEmailView });
const orderConfirmationEmailTextLayout = fs.readFileSync(path.join(__dirname, "order-confirmation-email.text")).toString();
const bareReceiptEmailView = fs.readFileSync(path.join(__dirname, "receipt-email.html")).toString();
const receiptEmailLayout = mustache.render(emailLayout, { content: bareReceiptEmailView });
const receiptEmailTextLayout = fs.readFileSync(path.join(__dirname, "receipt-email.text")).toString();

module.exports = (maerkelex, paymentGateway, db, mailer) => {
    ensurePurchasesDbExists(db);

    return {
        start: (requestBody, order, customerInfo, callback) => startPurchase(maerkelex, paymentGateway, db, requestBody, order, customerInfo, callback),
        complete: (id, nonce, callback) => completePurchase(paymentGateway, db, mailer, id, nonce, callback),
        sendReceipt: (id, callback) => sendPurchaseReceipt(db, mailer, id, callback),
        list: (callback) => listPurchases(db, callback),
        getHtmlReceipt: (id, callback) => getPurchaseHtmlReceipt(db, id, callback),
        markPosted: (id, callback) => markPurchasePosted(db, id, callback),
    };
};

function ensurePurchasesDbExists(db) {
    db.query("CREATE TABLE IF NOT EXISTS purchase (id uuid NOT NULL, status text NOT NULL, data json NOT NULL, started_at timestamp without time zone NOT NULL, completed_at timestamp without time zone)", (error) => {
        if(error) {
            console.error("Failed to ensure purchase database. May see erratic behaviour.", error);
        }
    });
}

function startPurchase(maerkelex, paymentGateway, db, requestBody, order, customerInfo, callback) {
    maerkelex.get(order.badgeId, (error, badge) => {
        if(error && error.type == "NotFound") {
            return callback({
                type: "InvalidOrder",
                trace: new Error("Trying to start purchase for badge that does not exist."),
                previous: error
            });
        }
        if(error) {
            return callback({
                trace: new Error("Failed to get maerkelex.dk data"),
                previous: error
            });
        }
        if(!badge.price && badge.price !== 0) {
            return calback({ type: "BadgeNotForSale", badge: badge });
        }
        if(!badge.shippingPrice && badge.shippingPrice !== 0) {
            return callback({
                trace: new Error("Could not find shipping price for badge"),
                previous: error,
                badge: badge
            });
        }

        paymentGateway.clientToken.generate({}, (error, braintreeResponse) => {
            if(error) {
                return callback({
                    trace: new Error("Failed to generate braintree token"),
                    previous: error
                });
            }

            var priceForBadges = badge.price * order.count;
            var total = (badge.shippingPrice + priceForBadges).toFixed(2);

            var paymentId = uuid.v4();
            var viewModel = {
                date: new Date().toISOString().substring(0, 10),
                orderLines: [
                    {
                        description: badge.name + " mærke, " + order.count + " stk.",
                        count: order.count,
                        unitPrice: badge.price.toFixed(2),
                        price: priceForBadges.toFixed(2)
                    },
                    {
                        description: "Forsendelse",
                        price: badge.shippingPrice.toFixed(2)
                    }
                ],
                total: total,
                vat: (total * 0.2).toFixed(2),
                customerInfo: customerInfo,
                deliveryAddressShort: customerInfo.deliveryAddress.address + ", " + customerInfo.deliveryAddress.postalCode + " " + customerInfo.deliveryAddress.city,
                clientToken: braintreeResponse.clientToken,
                orderNumber: paymentId
            };

            var paymentData = {
                viewModel: viewModel,
                paymentId: paymentId,
                total: total,
                startedAt: new Date().toISOString(),
                originalRequest: requestBody,
                owner: "admin"
            };

            insertStartedPurchaseRecord(db, paymentData, (error) => {
                if(error) {
                    return callback(error);
                }
                callback(null, paymentData);
            });
        });
    });
}

function insertStartedPurchaseRecord(db, paymentData, callback) {
    db.query("INSERT INTO purchase (id, status, data, started_at) VALUES ($1::uuid, $2::text, $3::json, $4::timestamp)", [
        paymentData.paymentId,
        "started",
        paymentData,
        new Date().toISOString()
    ], (error) => {
        if(error) {
            return callback({
                trace: new Error("Failed to create purchase record for new purchase"),
                previous: error,
                paymentData: paymentData
            });
        }
        callback(null, paymentData);
    });
}

function completePurchase(paymentGateway, db, mailer, id, nonce, callback) {
    getPurchase(db, id, (error, purchase) => {
        if(error) {
            return callback(error);
        }
        if(purchase.status != "started") {
            return callback({
                type: "PurchaseInvalidState",
                trace: new Error("Someone requested to complete a purchase that has already been completed."),
                purchase: purchase
            });
        }
        paymentGateway.transaction.sale({
            amount: purchase.data.total,
            paymentMethodNonce: nonce,
            options: {
                submitForSettlement: true
            }
        }, (error, result) => {
            if(error) {
                return callback({
                    trace: new Error("Payment completion failed"),
                    previous: error,
                    purchase: purchase
                });
            }
            if(!result.success) {
                return failPurchase(db, id, result, callback);
            }
            purchase.data.completedAt = new Date().toISOString();
            updatePurchase(db, id, "completed", purchase.data, (error) => {
                if(error) {
                    return callback({
                        trace: new Error("Failed to update purchase, setting it as completed!"),
                        previous: error
                    });
                }
                var orderConfirmationEmail = mustache.render(orderConfirmationEmailLayout, purchase.data.viewModel);
                var orderConfirmationEmailText = mustache.render(orderConfirmationEmailTextLayout, purchase.data.viewModel);
                var recipient = purchase.data.viewModel.customerInfo;
                mailer.send({
                    subject: "Ordrebekræftigelse fra Mærkelex",
                    html: orderConfirmationEmail,
                    text: orderConfirmationEmailText
                }, recipient, (error) => {
                    if(error) {
                        console.error("Failed to send confirmation email.", error);
                        //TODO: Register this somewhere so we can deal with it and manually send?
                        // one model would have a task list of emails to send, generate from those
                        // missing on launch, or at intervals. Every x time, check for pending emails,
                        // if one isn't on the list, add it.
                    }
                    mailer.send({
                        subject: "Ny ordre til Mærkelex",
                        html: "Der er kommet en ny ordre.",
                        text: "Der er kommet en ny ordre."
                    }, { email: "kontakt@maerkelex.dk" }, (error) => {
                        if(error) {
                            console.error("Failed to send new order notification", error);
                            //TODO: Register this somewhere or add emails to queue or something?
                        }
                        callback();
                    });
                });
            });
        });
    });
}

function getPurchase(db, id, callback) {
    db.query("SELECT * FROM purchase WHERE id = $1::uuid", [ id ], (error, result) => {
        if(error) {
            return callback({
                trace: new Error("Failed to get purchase from database"),
                previous: error
            });
        }
        if(result.rows.length == 0) {
            return callback({
                type: "PurchaseNotFound",
                trace: new Error("Someone requested to complete a purchase that does not exist."),
                purchaseId: id
            });
        }
        var purchase = result.rows[0];
        callback(null, purchase);
    });
}

function updatePurchase(db, id, status, data, callback) {
    db.query("UPDATE purchase SET status = $1::text, data = $2::json WHERE id = $3::uuid", [
        status,
        data,
        id
    ], callback);
}

function failPurchase(db, purchaseId, result, callback) {
    console.error("Payment request was unsuccesful", result, result.errors.deepErrors());

    db.query("UPDATE purchase SET status = $1::text WHERE id = $2::uuid", [ "failed", purchaseId ], (error) => {
        if(error) {
            return callback({
                trace: new Error("Failed to set purchase as failed"),
                previous: error,
                purchaseId: purchaseId
            });
        }
        callback({
            type: "InvalidPaymentInformation",
            trace: new Error("Failed succesfully (purchase failure registered)")
        });
    });
}

function sendPurchaseReceipt(db, mailer, id, callback) {
    getPurchase(db, id, (error, purchase) => {
        if(error) {
            return callback(error);
        }
        if(purchase.status != "completed") {
            return callback({
                type: "CanNotDispatchPurchase",
                trace: new Error("Could not send purchase receipt because it is not in `completed` state."),
                purchase: purchase
            });
        }
        var receiptEmail = renderHtmlReceipt(purchase);
        var receiptEmailText = mustache.render(receiptEmailTextLayout, purchase.data.viewModel);
        var recipient = purchase.data.viewModel.customerInfo;
        mailer.send({
            subject: "Din ordre fra Mærkelex er på vej. Her er din kvittering.",
            html: receiptEmail,
            text: receiptEmailText
        }, recipient, (error) => {
            if(error) {
                return callback({
                    trace: new Error("Failed to send receipt email"),
                    previous: error,
                    purchase: purchase
                });
            }
            purchase.data.dispatchedAt = new Date().toISOString();
            updatePurchase(db, id, "dispatched", purchase.data, (error) => {
                if(error) {
                    return callback({
                        trace: new Error("Failed to set purchase as dispatched"),
                        previous: error,
                        purchase: purchase
                    });
                }
                callback();
            });
        });
    });
}

function renderHtmlReceipt(purchase) {
    return mustache.render(receiptEmailLayout, purchase.data.viewModel);
}

function listPurchases(db, callback) {
    db.query("SELECT * FROM purchase", (error, result) => {
        if(error) {
            console.error("Failed to get purchases to list", error);
            return callback(error);
        }
        callback(null, result.rows);
    });
}

function getPurchaseHtmlReceipt(db, id, callback) {
    getPurchase(db, id, (error, purchase) => {
        if(error) {
            return callback(error);
        }
        if(purchase.status != "dispatched") {
            return callback({
                type: "NoReceiptForPurchaseExists",
                trace: new Error("Could not get receipt for purchase because it has not yet been dispatched."),
                purchase: purchase
            });
        }
        callback(null, renderHtmlReceipt(purchase));
    });
}

function markPurchasePosted(db, id, callback) {
    getPurchase(db, id, (error, purchase) => {
        if(error) {
            return callback(error);
        }

        purchase.data.postedToAccounting = true;

        updatePurchaseData(db, id, purchase.data, (error) => {
            if(error) {
                return callback({
                    trace: new Error("Failed to mark purchase as posted"),
                    previous: error,
                    purchase
                });
            }
            callback();
        });
    })
}

function updatePurchaseData(db, id, data, callback) {
    db.query("UPDATE purchase SET data = $1::json WHERE id = $2::uuid", [
        data,
        id
    ], callback);
}
