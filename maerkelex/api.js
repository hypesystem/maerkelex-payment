var request = require("request");

function MaerkelexApi(config) {
    return {
        get: get.bind(this, config.baseUrl)
    };
}

function get(baseUrl, badgeIds, callback) {
    getData(baseUrl, (error, data) => {
        if(error) {
            return callback(error);
        }
        var badges = data.m.filter(m => badgeIds.includes(m.id));
        if(!badges.length || badges.length != badgeIds.length) {
            return callback({
                type: "NotFound",
                trace: new Error("Some requested badge IDs were not found."),
                badgeIds: badgeIds.filter((id) => !data.m.some(m => m.id == id)),
            });
        }
        callback(null, badges, {
            domestic: data.defaultShippingPrice,
            international: data.internationalShippingPrice,
        });
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
