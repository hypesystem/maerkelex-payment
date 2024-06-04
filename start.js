import config from "config";
import braintree from "braintree";
import maerkelexPaymentApp from "./app.js";
import pkg from "./package.json" assert { type: "json" };
import maerkelexApi from "./maerkelex/api.js";
import MailgunMustacheMailer from "mailgun-mustache-mailer";
import pg from "pg";
const { Pool } = pg;
import Stock from "./stock/index.js";
import Purchases from "./purchases/index.js";
import cookieSession from "cookie-session";
import billyApi from "./billy/index.js";

config.braintree.environment = braintree.Environment[config.braintree.environment];

var maerkelex = maerkelexApi(config.maerkelex);
var paymentGateway = braintree.connect(config.braintree);
var db = new Pool(config.postgres);
var mailer = new MailgunMustacheMailer(config.mailgun, {info: console.log});
let cookieSessionInstance = cookieSession({
    name: "maerkelex-payment-session-cookie",
    secret: config.sessionTokenSecret
});
const stock = Stock(db, maerkelex);
let purchases = Purchases(maerkelex, paymentGateway, db, mailer, cookieSessionInstance, stock);
var billy = billyApi(config.billy, purchases, stock);

var app = await maerkelexPaymentApp(purchases, db, cookieSessionInstance, billy, maerkelex, stock, config.maerkelex.baseUrl);

app.listen(config.port);

console.log("maerkelex-payment@" + pkg.version + " listening on port " + config.port);
