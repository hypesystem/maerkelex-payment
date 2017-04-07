const express = require("express");

module.exports = (db) => {
    let app = express();

    app.get("/", (req, res) => {

        getPostgresStatus(db, (error, postgresStatus) => {
            if(error) {
                return res.send({
                    status: "NOT OK",
                    postgres: error
                });
            }
            return res.send({
                status: "OK",
                postgres: postgresStatus
            });
        });
    });

    return app;
};

function getPostgresStatus(db, callback) {
    db.query("SELECT VERSION() AS version, NOW() as datetime", (error, result) => {
        if(error) return callback({ status: "NOT OK", error: error.code });
        callback(null, {
            status: "OK",
            version: result.rows[0].version,
            datetime: result.rows[0].datetime
        });
    });
}
