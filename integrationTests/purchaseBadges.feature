Feature: Purchase badges
    As a badge enthusiast
    I want to order badges
    In order to show off my mad skillz on my uniform

    Scenario: Start a purchase
        Given the Mærkelex website has the following badges:
        | id       | name     | price | shippingPrice |
        | 24-timer | 24 timer | 30    |               |
        | 36-timer | 36 timer |       |               |
        And the Mærkelex website has a standard shipping price of 50
        When I start a purchase of 15 of the 24-timer badge with this customer information:
        | name    | address | postalCode | city    | email     | phoneNumber |
        | Niels A | Vej 12  | 2720       | Vanløse | e@mail.co | 12341234    |
        Then I should see an order overview
        And the order overview should contain 15 of the "24 timer" badge, each costing 30, totalling 450
        And the order overview should contain shipping costing 50
        And the order total should be 500
        And I should see a card payment form
        And I should see a button to complete payment

    Scenario: Complete purchase
        Given the Mærkelex website has the following badges:
        | id       | name     | price | shippingPrice |
        | 24-timer | 24 timer | 30    |               |
        | 36-timer | 36 timer |       |               |
        And the Mærkelex website has a standard shipping price of 50
        And I started a purchase of 15 of the 24-timer badge with this customer information:
        | name    | address | postalCode | city    | email     | phoneNumber |
        | Niels A | Vej 12  | 2720       | Vanløse | e@mail.co | 12341234    |
        When I pay with my card details:
        | cardNumber       | expiryMonth | expiryYear | ccv |
        | 4111111111111111 | 01          | 21         | 111 |
        Then I should see a message that the purchase succeeded
        And I should receive an email with a receipt for my purchase
        And the email should list 15 of the "24 timer" badge, each costing 30, totalling 450
        And the email should list shipping costing 50
        And the email should list a total cost of 500.
