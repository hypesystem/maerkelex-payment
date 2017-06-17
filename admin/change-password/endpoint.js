module.exports = (users) => (req, res) => {
    let newPassword = req.body.password;
    if(!newPassword) {
        return req.status(400).send({error: "No new password provided"});
    }
    users.changePassword(req.session.username, newPassword, (error) => {
        if(error) {
            console.error(`Failed to change password for ${req.session.username}`, error);
            return res.fail(500);
        }
        res.redirect("/");
    });
};
