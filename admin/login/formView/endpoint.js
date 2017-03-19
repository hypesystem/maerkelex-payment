const fs = require("fs");
const path = require("path");
const formView = fs.readFileSync(path.join(__dirname, "formView.html")).toString();

module.exports = (users) => (req, res) => {
    res.send(formView);
};
