var config = require("config");
var braintree = require("braintree");
var maerkelexPaymentApp = require("./app.js");
var pkg = require("./package.json");
var maerkelexApi = require("./maerkelex/api.js");
var MailgunMustacheMailer = require("mailgun-mustache-mailer");
var Pool = require("pg-pool");

config.braintree.environment = braintree.Environment[config.braintree.environment];

var maerkelex = maerkelexApi(config.maerkelex);
var paymentGateway = braintree.connect(config.braintree);
var db = new Pool(config.postgres);
var mailer = new MailgunMustacheMailer(config.mailgun);

var app = maerkelexPaymentApp(maerkelex, paymentGateway, db, mailer);

app.listen(3000);

console.log("maerkelex-payment@" + pkg.version + " listening on port 3000");
