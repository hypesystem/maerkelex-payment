import maerkelexApp from "./maerkelexApp.js";
import app from "../../app.js";
import Browser from "zombie";
import { defineSupportCode } from 'cucumber';
import braintree from "braintree";
import maerkelexApi from "../../maerkelex/api.js.js";
import MailgunMustacheMailer from "mailgun-mustache-mailer";
import Pool from "pg-pool";
import config from "config";
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
