var config = require("config");
var braintree = require("braintree");
var maerkelexPaymentApp = require("./app.js");
var pkg = require("./package.json");
var maerkelexApi = require("./maerkelex/api.js");
var MailgunMustacheMailer = require("mailgun-mustache-mailer");
const { Pool } = require("pg");
const Stock = require("./stock");
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
const stock = Stock(db, maerkelex);
let purchases = Purchases(maerkelex, paymentGateway, db, mailer, cookieSessionInstance, stock);
var billy = billyApi(config.billy, purchases, stock);

var app = maerkelexPaymentApp(purchases, db, cookieSessionInstance, billy, maerkelex, stock);

app.listen(config.port);

console.log("maerkelex-payment@" + pkg.version + " listening on port " + config.port);
