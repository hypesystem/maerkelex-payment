const uuid = require("uuid");
const crypto = require("crypto");

module.exports = (db) => {
    ensureUsersDbAndDefaultUserExists(db);

    return {
        list: (callback) => listUsers(db, callback),
        create: (username, password, callback) => createUser(db, username, password, callback),
        login: (username, password, callback) => logUserIn(db, username, password, callback),
        authenticate: (token, callback) => authenticateUser(db, token, callback)
    };
};

function ensureUsersDbAndDefaultUserExists(db) {
    db.query("CREATE TABLE IF NOT EXISTS users (id uuid NOT NULL, data json NOT NULL)", (error) => {
        if(error) {
            return console.error("Failed to ensure users database. May see erratic behaviour.", error);
        }
        ensureDefaultUserExists(db);
    });
}

function ensureDefaultUserExists(db) {
    listUsers(db, (error, users) => {
        if(error) {
            return console.error("Failed to list users and then ensure admin user", error);
        }
        if(users.find(x => x.username == "admin")) {
            return;
        }
        createUser(db, "admin", "admin", (error) => {
            if(error) {
                console.error("Failed to ensure default admin user.", error);
            }
        });
    });
}

function listUsers(db, callback) {
    db.query("SELECT * FROM users", (error, result) => {
        if(error) {
            return callback({
                trace: new Error("Failed to list error"),
                previous: error
            });
        }
        callback(null, result.rows.map(x => {
            let user = x.data;
            user.id = x.id;
            return user;
        }));
    });
}

function createUser(db, username, password, callback) {
    let id = uuid.v4();
    crypto.randomBytes(32, (error, salt) => {
        if(error) {
            return callback(error);
        }
        let user = {
            username: username,
            hashedPassword: hashPassword(password, salt),
            salt: salt.toString("hex")
        };
        db.query("INSERT INTO users (id, data) VALUES ($1::uuid, $2::json)", [ id, user ], (error) => {
            if(error) {
                return callback({
                    trace: new Error("Failed to create user"),
                    previous: error,
                    user: user
                });
            }
            user.id = id;
            callback(null, user);
        });
    });
}

function hashPassword(password, salt) {
    return crypto.createHash("sha256").update(salt).update(password).digest("hex");
}

function logUserIn(db, username, password, callback) {

}

function authenticate(db, token, callback) {

}
