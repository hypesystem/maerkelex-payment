import axios from "axios";
import Puppeteer from "puppeteer";

export default (config, purchases, stock) => {
    let state = {};

    const billyAxios = axios.create({
        baseURL: config.baseUrl,
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

    getRelevantAccounts(billyAxios)
        .then((accounts) => {
            console.log("[billy] loaded account info", Object.keys(accounts).map((key) => accounts[key].name));
            state.accounts = accounts;
        })
        .catch((error) => console.error("failed to get accounts - billy integration will be unusable!", error));

    return {
        createOrderTransaction: (id, callback) => createOrderTransaction(purchases, config, billyAxios, stock, state, id, callback)
    };
};

function createOrderTransaction(purchases, config, billyAxios, stock, state, id, callback) {
    purchases.get(id, (error, purchase) => {
        if(error) {
            return callback(error);
        }

        uploadReceiptAttachment(purchases, billyAxios, state, id, (error, pdfReceiptJson) => {
            if(error) {
                return callback(error);
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

            const badgeOrderLines = purchase.data.viewModel.orderLines
                .filter(({ id }) => id);

            // TODO: optimizable db call?
            Promise.all(badgeOrderLines.map(({ id }) => stock.getBadgeCosts(id)))
                .then((badgeCosts) => {
                    const badgeCostsById = {};
                    badgeOrderLines.forEach(({ id }, i) => badgeCostsById[id] = badgeCosts[i]);

                    let stockCost = 0;
                    badgeOrderLines
                        .forEach((line) => {
                            const badgeCost = badgeCostsById[line.id];
                            stockCost += badgeCost.productionCost * line.count;
                        });

                    let { salesAccount, salesVatAccount, owedByPartnersAccount, stockValueAccount, stockSpendAccount } = state.accounts;

                    // Create transaction + postings matching purchase in Billy, incl attachments
                    billyAxios.post(`/daybookTransactions`, {
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
                                {
                                    accountId: stockValueAccount.id,
                                    amount: stockCost,
                                    side: "credit",
                                    priority: 4,
                                },
                                {
                                    accountId: stockSpendAccount.id,
                                    amount: stockCost,
                                    side: "debit",
                                    priority: 5,
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
                    })
                        .then((response) => {
                            let transactionCreateJson;
                            try {
                                //Already in JSON format, becasue we post using the `json` field above.
                                transactionCreateJson = response.data.daybookTransactions[0];
                            }
                            catch(error) {
                                return callback({
                                    trace: new Error("Failed to read transaction creation response"),
                                    previous: error,
                                    body: response.data,
                                });
                            }

                            Promise.all(badgeOrderLines.map(async ({ id, count }) => stock.reduceStockForBadge(id, count)))
                                .then(() => {

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
                                })
                                .catch((error) => {
                                    callback({
                                        trace: new Error("Failed to reduce stock count for at least some order lines"),
                                        badgeOrderLines,
                                        previous: error,
                                    });
                                });
                        })
                        .catch((error) => callback({
                            type: "FailedToCreateTransactions",
                            trace: new Error("Failed to create transactions to Billy"),
                            previous: error,
                        }));
                })
                .catch((error) => {
                    callback({
                        trace: new Error("Failed to get badge costs for at least some badge ID"),
                        badgeOrderLines,
                        previous: error,
                    });
                });
        });
    });
}

function uploadReceiptAttachment(purchases, billyAxios, state, id, callback) {
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
        .then(async (pdfReceiptBuffer) => {
            let response;
            try {
                response = await billyAxios.post(`/files`, pdfReceiptBuffer, {
                    headers: {
                        'Content-Type': 'application/pdf',
                        'X-Filename': 'kvittering.pdf',
                    },
                });
            }
            catch(error) {
                throw {
                    type: "FailedToUploadReceipt",
                    trace: new Error("Failed to upload receipt to Billy"),
                    previous: error,
                };
            }

            callback(null, response.data.files[0]);
        })
        .catch((error) => {
            callback({
                type: "PdfGenerationFailed",
                trace: new Error("Failed to make PDF receipt", error),
                previous: error
            });
        });
    });
}

async function getRelevantAccounts(billyAxios) {
    const accounts = await Promise.all([ 1110, 7250, 5820, 5830, 1210 ].map(async (accountNo) => {
        const response = await billyAxios.get(`/accounts?accountNo=${accountNo}`);
        if(response.status !== 200) {
            throw {
                type: "AccountLoadingFailed",
                trace: new Error("Failed to load account information for account " + accountNo),
                response,
            };
        }

        return response.data.accounts[0];
    }));

    const [ salesAccount, salesVatAccount, owedByPartnersAccount, stockValueAccount, stockSpendAccount ] = accounts;
    return { salesAccount, salesVatAccount, owedByPartnersAccount, stockValueAccount, stockSpendAccount };
}

function billifyDate(date) {
    if(!date) return "";
    return date.substring(0, 10);
}
