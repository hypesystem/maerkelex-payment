import uuid from "uuid";
import crypto from "crypto";

export default (db) => {
    ensureUsersDbAndDefaultUserExists(db);

    return {
        list: (callback) => listUsers(db, callback),
        create: (username, password, callback) => createUser(db, username, password, callback),
        changePassword: (username, newPassword, callback) => changePassword(db, username, newPassword, callback)
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
    saltAndHashPassword(password, (error, salt, hashedPassword) => {
        if(error) {
            return callback(error);
        }
        let user = {
            username: username,
            hashedPassword: hashedPassword,
            salt: salt
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

function saltAndHashPassword(password, callback) {
    crypto.randomBytes(32, (error, salt) => {
        if(error) {
            return callback(error);
        }
        salt = salt.toString("hex");
        callback(null, salt, hashPassword(password, salt));
    });
}

function hashPassword(password, salt) {
    return crypto.createHash("sha256").update(salt).update(password).digest("hex");
}

function changePassword(db, username, newPassword, callback) {
    db.query("SELECT * FROM users", (error, result) => {
        if(error) {
            return callback({
                trace: new Error("Failed to list error"),
                previous: error
            });
        }
        let row = result.rows.find(r => r.data.username == username);
        if(!row) {
            return callback({
                trace: new Error("Failed to find user with username " + username + " to change password for.")
            });
        }
        let data = row.data;
        saltAndHashPassword(newPassword, (error, salt, hashedPassword) => {
            if(error) {
                return callback(error);
            }
            data.hashedPassword = hashedPassword;
            data.salt = salt;
            db.query("UPDATE users SET data=$2::json WHERE id=$1::uuid", [ row.id, data ], (error) => {
                if(error) {
                    return callback({
                        trace: new Error("Failed to update password for " + username),
                        previous: error,
                        user: data
                    });
                }
                callback();
            });
        });
    });
}
