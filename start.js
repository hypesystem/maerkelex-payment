var config = require("config");
var braintree = require("braintree");
var maerkelexPaymentApp = require("./app.js");
var pkg = require("./package.json");
var maerkelexApi = require("./maerkelex/api.js");
var MailgunMustacheMailer = require("mailgun-mustache-mailer");
var Pool = require("pg-pool");
const cookieSession = require("cookie-session");

config.braintree.environment = braintree.Environment[config.braintree.environment];

var maerkelex = maerkelexApi(config.maerkelex);
var paymentGateway = braintree.connect(config.braintree);
var db = new Pool(config.postgres);
var mailer = new MailgunMustacheMailer(config.mailgun);
let cookieSessionInstance = cookieSession({
    name: "maerkelex-payment-session-cookie",
    secret: "abb304c8-4b8e-4668-a744-451770259de0"
});

var app = maerkelexPaymentApp(maerkelex, paymentGateway, db, mailer, cookieSessionInstance);

app.listen(3000);

console.log("maerkelex-payment@" + pkg.version + " listening on port 3000");
