const {defineSupportCode} = require('cucumber');

defineSupportCode(({After}) => {
  After(function() {
      this.maerkelexServer.close();
      this.server.close();
  });
});
