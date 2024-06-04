import { defineSupportCode } from 'cucumber';

defineSupportCode(({Given, When, Then}) => {
    Given('we implement this', function(callback) {
        callback(null, 'pending');
    });

    When('it runs', function(callback) {
        callback(null, 'pending');
    });

    Then('it should work', function(callback) {
        callback(null, 'pending');
    });
});
