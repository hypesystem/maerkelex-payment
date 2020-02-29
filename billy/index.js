const request = require("request");
const async = require("async");
const Puppeteer = require("puppeteer");

module.exports = (config, purchases) => {
    let state = {};
    let billyRequest = request.defaults({
        baseUrl: config.baseUrl,
        headers: {
            'X-Access-Token': config.apiKey,
        },
    });

    Puppeteer.launch({
        //DANGERZONE: adding --no-sandbox because the docker container is running as root,
        //            and chromium cannot run without --no-sandbox when running as root.
        //            So here we are. This disables the sandbox. A better solution might
        //            be to change the Dockerfile, but I'm not sure about the consequences
        //            of that atm.
        args: [ "--no-sandbox" ]
    })
    .then((newBrowser) => state.browser = newBrowser)
    .then(() => console.log("[billy] created chromium instance to use for pdf generation"));

    getRelevantAccounts(billyRequest, (error, accounts) => {
        if(error) {
            return console.error("failed to get accounts - billy integration will be unusable!", error);
        }
        console.log("[billy] loaded account info", Object.keys(accounts).map((key) => accounts[key].name));
        state.accounts = accounts;
    });

    return {
        createOrderTransaction: (id, callback) => createOrderTransaction(purchases, config, billyRequest, state, id, callback)
    };
};

function createOrderTransaction(purchases, config, billyRequest, state, id, callback) {
    purchases.get(id, (error, purchase) => {
        if(error) {
            return callback(error);
        }

        purchases.getHtmlReceipt(id, (error, htmlReceipt) => {
            if(error) {
                return callback(error);
            }

            // Create and upload pdf receipt to Billy
            state.browser.newPage()
            .then((page) => {
                return page.setContent(htmlReceipt)
                    .then(() => page.pdf({ printBackground: true })
                    .then((pdf) => {
                        page.close();
                        return pdf;
                    }));
            })
            .then((pdfReceiptBuffer) => {
                billyRequest.post(`/files`, {
                    headers: {
                        'Content-Type': 'application/pdf',
                        'X-Filename': 'kvittering.pdf',
                    },
                    body: pdfReceiptBuffer,
                }, (error, response) => {
                    if(error) {
                        return callback({
                            type: "FailedToUploadReceipt",
                            trace: new Error("Failed to upload receipt to Billy"),
                            previous: error,
                        });
                    }

                    if(response.statusCode !== 200) {
                        return callback({
                            type: "FailedToUploadReceipt",
                            trace: new Error("Failed to upload receipt to Billy"),
                            status: response.statusCode,
                            body: response.body,
                        });
                    }

                    let pdfReceiptJson;
                    try {
                        pdfReceiptJson = JSON.parse(response.body).files[0];
                    }
                    catch(error) {
                        return callback({
                            trace: new Error("Failed to read receipt upload response"),
                            previous: error,
                            body: response.body,
                        });
                    }

                    let totalAmount = purchase.data.total;
                    let excludingVatAmount = parseFloat((totalAmount * 0.8).toFixed(2));
                    let vatAmount = parseFloat((totalAmount * 0.2).toFixed(2));

                    // Sanity check of calculation of numbers -- Floats are mischevious, so at least here we get a warning?
                    let totalAmountAlternateCalculation = parseFloat((excludingVatAmount * 1.25).toFixed(2));
                    let totalAmountOtherAlternateCalculation = parseFloat((excludingVatAmount + vatAmount).toFixed(2));

                    let totalAmountAlternateMismatch = totalAmount < totalAmountAlternateCalculation || totalAmount > totalAmountAlternateCalculation;
                    let totalAmountOtherAlternateMismatch = totalAmount < totalAmountOtherAlternateCalculation || totalAmount > totalAmountOtherAlternateCalculation;

                    if(totalAmountAlternateMismatch || totalAmountOtherAlternateMismatch) {
                        console.warn("Sanity check failed: total amount when recalculated did not match original total amount.", {
                            totalAmount,
                            excludingVatAmount,
                            vatAmount,
                            totalAmountAlternateCalculation,
                            totalAmountOtherAlternateCalculation
                        });
                    }

                    let { salesAccount, salesVatAccount, owedByPartnersAccount } = state.accounts;

                    // Create transaction + postings matching purchase in Billy, incl attachments
                    billyRequest.post(`/daybookTransactions`, {
                        json: {
                            daybookTransaction: {
                                organizationId: config.organizationId,
                                entryDate: billifyDate(purchase.data.dispatchedAt),
                                description: "Online salg",
                                state: "approved",
                                lines: [
                                    {
                                        accountId: salesAccount.id,
                                        amount: excludingVatAmount,
                                        side: "credit",
                                        priority: 1,
                                    },
                                    {
                                        accountId: salesVatAccount.id,
                                        amount: vatAmount,
                                        side: "credit",
                                        priority: 2,
                                    },
                                    {
                                        accountId: owedByPartnersAccount.id,
                                        amount: totalAmount,
                                        side: "debit",
                                        priority: 3,
                                    },
                                ],
                                attachments: [
                                    {
                                        organizationId: config.organizationId,
                                        fileId: pdfReceiptJson.id,
                                        priority: 1,
                                    }
                                ],
                            }
                        }
                    }, (error, response) => {
                        if(error) {
                            return callback({
                                type: "FailedToCreateTransactions",
                                trace: new Error("Failed to create transactions to Billy"),
                                previous: error,
                            });
                        }
        
                        if(response.statusCode !== 200) {
                            return callback({
                                type: "FailedToCreateTransactions",
                                trace: new Error("Failed to create transactions to Billy"),
                                status: response.statusCode,
                                body: response.body,
                            });
                        }

                        let transactionCreateJson;
                        try {
                            //Already in JSON format, becasue we post using the `json` field above.
                            transactionCreateJson = response.body.daybookTransactions[0];
                        }
                        catch(error) {
                            return callback({
                                trace: new Error("Failed to read transaction creation response"),
                                previous: error,
                                body: response.body,
                            });
                        }

                        // Save billy transaction ID in purchase.data.autoAccounted field, and save
                        let { id, createdTime } = transactionCreateJson;

                        purchase.data.postedToAccounting = true;
                        purchase.data.autoAccounted = {
                            transactionId: id,
                            createdTime,
                        };

                        purchases.update(purchase, (error) => {
                            if(error) {
                                return callback(error);
                            }

                            callback();
                        });
                    });
                });
            })
            .catch((error) => {
                callback({
                    type: "PdfGenerationFailed",
                    trace: new Error("Failed to make PDF receipt", error),
                    previous: error
                });
            });
        });
    });
}

function getRelevantAccounts(billyRequest, callback) {
    async.map([ 1110, 7250, 5820 ], function(accountNo, callback) {
        billyRequest.get(`/accounts?accountNo=${accountNo}`, (error, response) => {
            if(error) {
                return callback(error);
            }
            if(response.statusCode !== 200) {
                return callback({
                    type: "AccountLoadingFailed",
                    trace: new Error("Failed to load account information for account " + accountNo),
                    response
                });
            }

            var json;
            try {
                json = JSON.parse(response.body);
            }
            catch(e) {
                return callback(e);
            }

            callback(null, json.accounts[0]);
        });
    }, function(error, accounts) {
        if(error) {
            return callback(error);
        }
        let [ salesAccount, salesVatAccount, owedByPartnersAccount ] = accounts;
        callback(null, { salesAccount, salesVatAccount, owedByPartnersAccount });
    });
}

function billifyDate(date) {
    if(!date) return "";
    return date.substring(0, 10);
}
