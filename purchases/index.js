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
        sendReceipt: (id, callback) => sendPurchaseReceipt(paymentGateway, db, mailer, id, callback),
        list: (options, callback) => listPurchases(db, options, callback),
        get: (id, callback) => getPurchase(db, id, callback),
        update: (purchase, callback) => updatePurchase(db, purchase.id, purchase.status, purchase.data, callback),
        getHtmlReceipt: (id, callback) => getPurchaseHtmlReceipt(db, id, callback),
        markPosted: (id, callback) => markPurchasePosted(db, id, callback),
        createManualReceipt: (requestBody, callback) => createManualReceipt(maerkelex, db, requestBody, callback),
    };
};

function ensurePurchasesDbExists(db) {
    db.query("CREATE TABLE IF NOT EXISTS purchase (id uuid NOT NULL, status text NOT NULL, data json NOT NULL, started_at timestamp without time zone NOT NULL, completed_at timestamp without time zone)", (error) => {
        if(error) {
            console.error("Failed to ensure purchase database. May see erratic behaviour.", error);
        }
    });
}

function createManualReceipt(maerkelex, db, requestBody, callback) {
    const badgeOrder = requestBody.badges
        .map(({ id, count }) => {
            return { id, count: parseInt(count) };
        })
        .filter(({ id, count }) => id && count);

    const shippingCategory = requestBody.delivery;
    const date = requestBody.date;

    maerkelex.get(badgeOrder.map((badge) => badge.id), (error, { badges: badgeInfos, shipping }) => {
        if(error && error.type == "NotFound") {
            return callback({
                type: "InvalidOrder",
                trace: new Error("Trying to start purchase for badges that do not exist."),
                previous: error
            });
        }
        if(error) {
            return callback({
                trace: new Error("Failed to get maerkelex.dk data"),
                previous: error
            });
        }
        const badgesNotForSale = badgeInfos.filter((badge) => !badge.price && badge.price !== 0);
        if(badgesNotForSale.length) {
            return calback({ type: "BadgesNotForSale", badges: badgesNotForSale });
        }

        const shippingPrice = shipping[shippingCategory] || 0;

        const badgeOrderLines = badgeOrder
            .map((badge) => {
                const badgeInfo = badgeInfos.find((info) => info.id == badge.id);
                return {
                    ...badgeInfo,
                    ...badge,
                    lineTotal: badgeInfo.price * badge.count,
                };
            });

        var priceForBadges = badgeOrderLines
            .map((line) => line.lineTotal)
            .reduce((a, b) => a + b, 0);

        var total = (shippingPrice + priceForBadges).toFixed(2);
        const isPreorder = badgeInfos.some((badge) => badge.preorder);

        const orderLines = badgeOrderLines.map(({ name, count, price, lineTotal }) => {
            return {
                description: name + " mærke, " + count + " stk.",
                count,
                unitPrice: price.toFixed(2),
                price: lineTotal.toFixed(2)
            };
        });

        if(shippingPrice > 0) {
            orderLines.push({
                description: "Forsendelse",
                price: shippingPrice.toFixed(2)
            });
        }

        var paymentId = uuid.v4();
        var viewModel = {
            date,
            isPreorder,
            orderLines,
            total,
            vat: (total * 0.2).toFixed(2),
            customerInfo: {},
            deliveryAddressShort: "N/A",
            orderNumber: paymentId
        };

        var paymentData = {
            badgeIds: badgeOrder.map((badge) => badge.id),
            viewModel,
            paymentId,
            isPreorder,
            total,
            startedAt: new Date().toISOString(), //TODO: duplicate, also inserted on creation
            completedAt: date,
            dispatchedAt: date,
            originalRequest: requestBody,
            owner: "admin"
        };

        insertPurchaseRecord(db, "dispatched", paymentData, (error) => {
            if(error) {
                return callback(error);
            }
            callback(null, paymentData);
        });
    });
}

function startPurchase(maerkelex, paymentGateway, db, requestBody, badgeOrder, customerInfo, callback) {
    maerkelex.get(badgeOrder.map((badge) => badge.id), (error, { badges: badgeInfos, shipping }) => {
        if(error && error.type == "NotFound") {
            return callback({
                type: "InvalidOrder",
                trace: new Error("Trying to start purchase for badges that do not exist."),
                previous: error
            });
        }
        if(error) {
            return callback({
                trace: new Error("Failed to get maerkelex.dk data"),
                previous: error
            });
        }
        const badgesNotForSale = badgeInfos.filter((badge) => !badge.price && badge.price !== 0);
        if(badgesNotForSale.length) {
            return calback({ type: "BadgesNotForSale", badges: badgesNotForSale });
        }

        paymentGateway.clientToken.generate({}, (error, braintreeResponse) => {
            if(error) {
                return callback({
                    trace: new Error("Failed to generate braintree token"),
                    previous: error
                });
            }

            const shippingPrice = customerInfo.deliveryAddress.country == "Danmark" ? shipping.domestic : shipping.international;

            const badgeOrderLines = badgeOrder
                .map((badge) => {
                    const badgeInfo = badgeInfos.find((info) => info.id == badge.id);
                    return {
                        ...badgeInfo,
                        ...badge,
                        lineTotal: badgeInfo.price * badge.count,
                    };
                });

            var priceForBadges = badgeOrderLines
                .map((line) => line.lineTotal)
                .reduce((a, b) => a + b, 0);

            var total = (shippingPrice + priceForBadges).toFixed(2);
            const isPreorder = badgeInfos.some((badge) => badge.preorder);

            var paymentId = uuid.v4();
            var viewModel = {
                date: new Date().toISOString().substring(0, 10),
                isPreorder,
                orderLines: [
                    ...badgeOrderLines.map(({ id, name, count, price, lineTotal }) => {
                        return {
                            id,
                            description: name + " mærke, " + count + " stk.",
                            count,
                            unitPrice: price.toFixed(2),
                            price: lineTotal.toFixed(2),
                        };
                    }),
                    {
                        description: "Forsendelse",
                        price: shippingPrice.toFixed(2)
                    },
                ],
                total,
                vat: (total * 0.2).toFixed(2),
                customerInfo: customerInfo,
                deliveryAddressShort: customerInfo.deliveryAddress.address + ", " + customerInfo.deliveryAddress.postalCode + " " + customerInfo.deliveryAddress.city + ", " + customerInfo.deliveryAddress.country,
                clientToken: braintreeResponse.clientToken,
                orderNumber: paymentId
            };

            var paymentData = {
                badgeIds: badgeOrder.map((badge) => badge.id),
                viewModel,
                paymentId,
                isPreorder,
                total,
                startedAt: new Date().toISOString(), //TODO: duplicate, also inserted on creation
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
    insertPurchaseRecord(db, "started", paymentData, callback);
}

function insertPurchaseRecord(db, state, paymentData, callback) {
    db.query("INSERT INTO purchase (id, status, data, started_at) VALUES ($1::uuid, $2::text, $3::json, $4::timestamp)", [
        paymentData.paymentId,
        state,
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
        chargeForPreorderOrSaveCreditCardForPurchase(db, paymentGateway, nonce, purchase, (error) => {
            if(error) {
                return callback(error);
            }
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

function chargeForPreorderOrSaveCreditCardForPurchase(db, paymentGateway, paymentMethodNonce, purchase, callback) {
    if(purchase.data.isPreorder) {
        paymentGateway.transaction.sale({
            amount: purchase.data.total,
            paymentMethodNonce,
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
                return failPurchase(db, purchase, result, callback);
            }
            purchase.data.completedAt = new Date().toISOString();
            callback();
        });
        return;
    }

    paymentGateway.customer.create({
        paymentMethodNonce,
        creditCard: {
            options: {
                verifyCard: true,
                verificationAmount: purchase.data.total,
            },
        },
        //TODO: deviceData? for advanced fraud management?
    }, (error, result) => {
        if(error) {
            return callback({
                trace: new Error("Failed to validate credit card and save in Braintree Vault"),
                previous: error,
                purchase,
            });
        }
        if(!result.success) {
            return failPurchase(db, purchase, result, callback);
        }
        purchase.data.customerId = result.customer.id;
        purchase.data.paymentMethodToken = result.customer.paymentMethods[0].token;
        purchase.data.completedAt = new Date().toISOString();
        callback();
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

function failPurchase(db, purchase, result, callback) {
    console.error("Payment request was unsuccesful", result, result.errors.deepErrors());

    if(!purchase.data.errors) {
        purchase.data.errors = [];
    }

    purchase.data.errors.push({
        at: (new Date).toISOString(),
        data: result,
        description: "Payment request unsuccesful",
    });

    const newStatus = purchase.status == "completed" ? "completed" : "failed";

    updatePurchase(db, purchase.id, newStatus, purchase.data, (error) => {
        if(error) {
            return callback({
                trace: new Error("Failed to set purchase as failed"),
                previous: error,
                purchaseId: purchase.id,
                result,
            });
        }
        callback({
            type: "InvalidPaymentInformation",
            trace: new Error("Failed succesfully (purchase failure registered)")
        });
    });
}

function sendPurchaseReceipt(paymentGateway, db, mailer, id, callback) {
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
        ensureCustomerHasBeenCharged(paymentGateway, db, purchase, (error) => {
            if(error) {
                return callback(error);
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
    });
}

function ensureCustomerHasBeenCharged(paymentGateway, db, purchase, callback) {
    //If a paymentMethodToken does not exist, we have already taken the money
    if(!purchase.data.paymentMethodToken) {
        return callback();
    }

    paymentGateway.transaction.sale({
        paymentMethodToken: purchase.data.paymentMethodToken,
        amount: purchase.data.total,
        transactionSource: 'unscheduled',
        options: {
            submitForSettlement: true,
        },
    }, (error, result) => {
        if(error) {
            return callback({
                trace: new Error("Failed to charge customer with saved card info"),
                previous: error,
                purchase,
            });
        }
        if(!result.success) {
            return failPurchase(db, purchase, result, callback);
        }
        paymentGateway.customer.delete(purchase.data.customerId, (error) => {
            if(error) {
                //We don't want to fail hard because that might lead to doublecharging
                console.error({
                    trace: new Error("Failed to clean up customer (deleting credit card info) after charging."),
                    previous: error,
                    purchase,
                });
                return callback();
            }
            callback();
        });
    });
}

function renderHtmlReceipt(purchase) {
    return mustache.render(receiptEmailLayout, purchase.data.viewModel);
}

function listPurchases(db, options, callback) {
    if(!callback){
        callback = options
        options = {};
    }
   
    const offset = getOffset(options);
    const limit = getLimit(options);

    db.query(`SELECT * FROM purchase OFFSET ${offset} LIMIT ${limit}`, (error, result) => {
        if(error) {
            console.error("Failed to get purchases to list", error);
            return callback(error);
        }
        callback(null, result.rows);
    });
}

function getOffset(options){
    if(options["offset"]){
        return options["offset"];
    }
    return 0;
}

function getLimit(options){
    if(options["limit"]){
        return options["limit"];
    }
    return "ALL";
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
