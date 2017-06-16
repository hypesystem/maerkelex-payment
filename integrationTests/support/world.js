const maerkelexApp = require("./maerkelexApp");
const app = require("../../app");
const Browser = require("zombie");
const {defineSupportCode} = require('cucumber');
const braintree = require("braintree");
const maerkelexApi = require("../../maerkelex/api.js");
const MailgunMustacheMailer = require("mailgun-mustache-mailer");
const Pool = require("pg-pool");
const config = require("config");
config.braintree.environment = braintree.Environment[config.braintree.environment];

function CustomWorld() {
    let maerkelexPort = 3999;
    this.maerklexHost = "localhost:" + maerkelexPort;
    this.maerkelexApp = maerkelexApp();
    this.maerkelexServer = this.maerkelexApp.listen(maerkelexPort);

    let port = 3210;
    this.host = "localhost:" + port;

    let maerkelex = maerkelexApi(config.maerkelex);
    let paymentGateway = braintree.connect(config.braintree);
    let db = new Pool(config.postgres);
    let mailer = new MailgunMustacheMailer(config.mailgun);

    let cookieSessionInstance = cookieSession({
        name: "maerkelex-payment-session-cookie",
        secret: config.sessionTokenSecret
    });

    this.server = app(maerkelex, paymentGateway, db, mailer, cookieSessionInstance).listen(port);

    Browser.site = "http://" + this.host;
    this.browser = new Browser();
}

defineSupportCode(({setWorldConstructor}) => setWorldConstructor(CustomWorld));
