How do you take payments on a static website?
There are a lot of drop-in things you can do.
Here's a self-written service that takes over when the correct data is posted to it from the static site.
You see, static sites can easily have forms and frontend javascript building forms.

## Todo v0.1

- get mærkelex data (done)
- find badge and price and delivery cost (done)
- get delivery and invoicing data (done)
- show a responsive payment form (done)
- show error if order form posted was invalid (done)
  - cool: show the error and a link to "go back" (done)
- show error if starting payment failed (done)
  - cool: show the error and a link to "retry" (done)
- send order confirmation (done)
- failed payment, show error/retry/what? ^\___ both of these could be done async/ajaxly, so (done)
- complete payment, link back to page    _/    only a single page is needed here.           (done)
- admin interface overview (done)
- admin interface send receipt (done)
- **missing** handle user input errors from braintree
- **missing** login
- frontpage redirect to log in

### mærkelex-side

- expose price and shipping price in api (done)
- show form if mærke can be sold (done)
- DANGER: pressing s in form starts search ugh (done)
- **missing** validate form on client side

## Todo v0.2 **missing**

- Badges should have owning users, log in to that user to see sales
- Mærkelex staff: manage users
- Mærkelex staff: see overview of all income, mærkelex profits, users' remainders,
  uncompleted orders, etc... (monitor)
- fontpage link to overview of all badges sold through Mærkelex
- google analytics

## Todo v0.3 **missing**

- Contract generator builds a contract for new users to sign. Upload signed copy to website.
- Send payout requests through the system, manage them on Mærkelex' side.

## Todo v0.4 **missing**

- Figure out how to do passwords and sessions properly (auth token as session cookie? what is the right way?)

## Todo v1.0 **missing**

- Integration & unit tests of the whole shabang
- Extract payment module as a thing (config with views, handlers etc)
- Extract login handling as a thing (config with storing/retrieving username+passwordHash+salt; rest is handled)

## Todo v2.0 **missing**

- Use event sourcing, statically compiled views, thin thin thin server
