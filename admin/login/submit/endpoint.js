export default (users) => (req, res) => {
    let username = req.body.username;
    let password = req.body.password;
    if(!username || !password) {
        return res.redirect("/admin/login");
    }
    req.session.username = username;
    req.session.password = password;
    res.redirect("/admin");
};
