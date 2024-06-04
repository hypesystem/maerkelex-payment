import crypto from "crypto";

export default (users) => (req, res, next) => {
    if(!req.session.username || !req.session.password) {
        return res.redirect("/admin/login");
    }
    getUser(users, req.session.username, (error, user) => {
        if(error) {
            console.error("Failed to get user list", error);
            return res.fail(500);
        }
        if(passwordIsCorrect(user, req.session.password)) {
            return next();
        }
        return res.redirect("/admin/login");
    });
};

function getUser(users, username, callback) {
    users.list((error, users) => {
        if(error) {
            return callback(error);
        }
        let user = users.find(x => x.username == username);
        if(!user) {
            return callback({
                type: "NotFound",
                trace: new Error("User " + username + " not found"),
                users: users
            });
        }
        callback(null, user);
    })
}

function passwordIsCorrect(user, password) {
    return user.hashedPassword == hashPassword(password, user.salt);
}

function hashPassword(password, salt) {
    return crypto.createHash("sha256").update(salt).update(password).digest("hex");
}
