const fs = require("fs");
const path = require("path");
const inputView = fs.readFileSync(path.join(__dirname, "input-view.html")).toString();
const mustache = require("mustache");

module.exports = (maerkelex) => (req, res) => {
    maerkelex.getData((error, data) => {
        if(error) {
            console.error("Something went wrong", error);
            return res.fail(500, "Something went wrong");
        }
        res.send(mustache.render(inputView, {
            ...data,
            m: data.m.filter((badge) => badge.price || badge.price == 0),
        }));
    });
};
