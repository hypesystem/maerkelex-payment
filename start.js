var config = require("config");
var braintree = require("braintree");
var maerkelexPaymentApp = require("./app.js");
var pkg = require("./package.json");
var maerkelexApi = require("./maerkelex/api.js");
var MailgunMustacheMailer = require("mailgun-mustache-mailer");
var Pool = require("pg-pool");
const Purchases = require("./purchases/index");
const cookieSession = require("cookie-session");
const billyApi = require("./billy");

config.braintree.environment = braintree.Environment[config.braintree.environment];

var maerkelex = maerkelexApi(config.maerkelex);
var paymentGateway = braintree.connect(config.braintree);
var db = new Pool(config.postgres);
var mailer = new MailgunMustacheMailer(config.mailgun);
let cookieSessionInstance = cookieSession({
    name: "maerkelex-payment-session-cookie",
    secret: config.sessionTokenSecret
});
let purchases = Purchases(maerkelex, paymentGateway, db, mailer, cookieSessionInstance);
var billy = billyApi(config.billy, purchases);

var app = maerkelexPaymentApp(purchases, db, cookieSessionInstance, billy);

app.listen(config.port);

console.log("maerkelex-payment@" + pkg.version + " listening on port " + config.port);
