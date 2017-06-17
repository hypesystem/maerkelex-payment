const {defineSupportCode} = require('cucumber');
const Browser = require("zombie");

defineSupportCode(({Given, When, Then}) => {
    When(/^I start a purchase of ([0-9]+) of the ([^\s]+) badge with this customer information:$/, function(count, badgeId, table, callback) {
        //TODO: replace this with visiting a form on the maerkelexApp, filling it, then submitting
        this.browser.fetch("/", {
            method: "POST",
            body: makeFormSubmissionData(table.hashes()[0], count, badgeId)
        })
        .then(response => {
            console.log("got dis", response);
            callback(null, 'pending');
        })
        .catch(callback);
    });
});

function makeFormSubmissionData(tableData, count, badgeId) {
    let data = {
        "count": count,
        "badge": badgeId,
        "invoicing-name": tableData["name"],
        "invoicing-address": tableData["address"],
        "invoicing-postal-code": tableData["postalCode"],
        "invoicing-city": tableData["city"]
    };
    return Object.keys(data).map(key => key + "=" + data[key]).join("&");
}
