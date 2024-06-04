import { defineSupportCode } from 'cucumber';

defineSupportCode(({Given, When, Then}) => {
    Given('the Mærkelex website has the following badges:', function(table, callback) {
        let maerkelexApp = this.maerkelexApp;
        table.hashes().forEach((badge) => {
            badge.price = parseInt(badge.price) || null;
            badge.shippingPrice = parseInt(badge.shippingPrice) || null;
            maerkelexApp._addBadge(badge);
        });
        callback();
    });

    Given(/^the Mærkelex website has a standard shipping price of ([0-9]+)$/, function(shippingPrice, callback) {
        this.maerkelexApp._setDefaultShippingPrice(shippingPrice);
        callback();
    });
});
