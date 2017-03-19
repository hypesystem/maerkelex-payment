var request = require("request");

function MaerkelexApi(config) {
    return {
        get: get.bind(this, config.baseUrl)
    };
}

function get(baseUrl, badgeId, callback) {
    getData(baseUrl, (error, data) => {
        if(error) {
            return callback(error);
        }
        var badge = data.m.find(m => m.id == badgeId);
        if(!badge) {
            return callback({
                type: "NotFound",
                trace: new Error("Requested badgeId " + badgeId + " wasnt found.")
            });
        }
        if(!badge.shippingPrice) {
            badge.shippingPrice = data.defaultShippingPrice;
        }
        callback(null, badge);
    });
}

function getData(baseUrl, callback) {
    request.get(baseUrl + "/m.json", (error, httpResponse, body) => {
        if(error) {
            return callback(error);
        }
        if(httpResponse.statusCode != 200) {
            return callback(new Error("Failed to get mærkelex data (non-200 response): " + httpResponse.statusCode));
        }
        var json;
        try {
            json = JSON.parse(body);
        }
        catch(e) {
            return callback(new Error("Failed to parse json response: " + e));
        }
        callback(null, json);
    });
}

module.exports = MaerkelexApi;
