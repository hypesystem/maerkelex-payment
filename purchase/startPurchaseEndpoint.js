var uuid = require("uuid");
var fs = require("fs");
var path = require("path");
var view = fs.readFileSync(path.join(__dirname, "view.html")).toString();
var mustache = require("mustache");

module.exports = (purchases) => (req, res) => {
    //TODO v1: remove support for `badge` field and top level `count`
    let { badge, badges, count } = req.body;

    if(!badge && !badges) {
        return res.fail(400, "Forespørgslen specificerede ikke noget mærke.");
    }
    if(badge && badges) {
        return res.fail(400, "Forespørgslen specificerede mærker på flere måder der ikke kan forenes.");
    }
    if(badges && (badges.length == 0 || badges.some((badge) => !badge.id || badge.length == 0 || !badge.count || badge.count < 1))) {
        return res.fail(400, "Forespørgslen specificerede ingen mærker -- eller specificerede et mærke med et tomt ID-felt eller unden noget antal");
    }
    if(badge) {
        if(!count || count < 1) {
            return res.fail(400, "Forespørgslen specificerede ikke et antal af mærker.");
        }
        badges = [ { id: badge, count } ];
    }

    parseCustomerInfo(req.body, (error, customerInfo) => {
        if(error) {
            console.error("Failed to parse customer info", error, req.body);
            return res.fail(400, "Forespørgslen indeholdt ikke den påkrævede kundeinformation: " + error.message);
        }

        purchases.start(req.body, badges, customerInfo, (error, purchaseData) => {
            if(error && error.type == "InvalidOrder") {
                console.log("Invalid order received", error);
                return res.fail(400, "Der er noget galt med ordren i forespørgslen. Forsøg at udfylde formularen forfra.");
            }
            if(error && error.type == "BadgeNotForSale") {
                return res.fail(400, "Det forespurgte mærke sælges ikke gennem Mærkelex.");
            }
            if(error) {
                console.error("Failed to start purchase", error);
                return res.fail(500, req.body);
            }
            var response = mustache.render(view, purchaseData.viewModel);
            res.send(response);
        });
    });
};

function parseCustomerInfo(body, callback) {
    var customer = {};

    var email = body["email"];
    if(!email || !/.*@.*/.test(email)) {
        return callback({
            message: "Ingen email var specificeret, eller emailen var ugyldig."
        });
    }
    customer.email = email;

    var phoneNumber = body["phone-number"];
    if(!phoneNumber) {
        return callback({
            message: "Intet telefonnummer var specificeret."
        });
    }
    customer.phoneNumber = phoneNumber;

    parseAddresses(body, (error, invoicingAddress, deliveryAddress) => {
        if(error) {
            return callback(error);
        }
        customer.invoicingAddress = invoicingAddress;
        customer.deliveryAddress = deliveryAddress;
        customer.name = customer.invoicingAddress.name;

        callback(null, customer);
    });
}

function parseAddresses(body, callback) {
    parseAddress(body, "invoicing-", (error, invoicingAddress) => {
        if(error) {
            return callback(error);
        }
        if(!body["delivery-address-differs"]) {
            return callback(null, invoicingAddress, invoicingAddress);
        }
        parseAddress(body, "delivery-", (error, deliveryAddress) => {
            if(error) {
                return callback(error);
            }
            callback(null, invoicingAddress, deliveryAddress);
        });
    });
}

function parseAddress(body, prefix, callback) {
    var name = body[prefix + "name"];
    if(!name) {
        return callback({
            message: "Der manglede et navn på en adresse."
        });
    }

    var address = body[prefix + "address"];
    if(!address) {
        return callback({
            message: "Der manglede en adresselinje for en adresse."
        });
    }

    var postalCode = body[prefix + "postal-code"];
    if(!postalCode) {
        return callback({
            message: "Der manglede et postnummer for en adresse."
        });
    }

    var city = body[prefix + "city"];
    if(!city) {
        return callback({
            message: "Der manglede en by for en adresse."
        });
    }

    var country = body[prefix + "country"];
    if(!country) {
        return callback({
            message: "Der manglede et land på en adresse."
        });
    }

    callback(null, {
        name: name,
        address: address,
        postalCode: postalCode,
        city: city,
        country: country,
    });
}
