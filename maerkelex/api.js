const axios = require("axios");

// Bind context to function using `b`
const b = (fn, ...args) => fn.bind(null, ...args);
const cbify = (asyncFunction, callback) => {
    return function callbackified() {
        const promise = asyncFunction.apply(this, arguments);
        promise.then((data) => callback(null, data)).catch(callback);
    };
}

function MaerkelexApi(config) {
    return {
        get: cbify(b(get, config.baseUrl)),
        getData: cbify(b(getData, config.baseUrl)),
        getAsync: b(get, config.baseUrl),
        getDataAsync: b(getData, config.baseUrl),
    };
}

async function get(baseUrl, badgeIds) {
    const data = await getData(baseUrl);

    var badges = data.m.filter(m => badgeIds.includes(m.id));
    if(!badges.length || badges.length != badgeIds.length) {
        throw {
            type: "NotFound",
            trace: new Error("Some requested badge IDs were not found."),
            badgeIds: badgeIds.filter((id) => !data.m.some(m => m.id == id)),
        };
    }

    return {
        badges,
        shipping: {
            domestic: data.defaultShippingPrice,
            international: data.internationalShippingPrice,
        }
    };
}

async function getData(baseUrl) {
    const response = axios.get(baseUrl + "/m.json");
    return response.data;
}

module.exports = MaerkelexApi;
