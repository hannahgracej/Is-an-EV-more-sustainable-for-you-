/*
  Where the page sends analysis requests.

  On your laptop the local server is the API. On the CloudFront site, /api is
  the same distribution, rewritten to API Gateway. Opening the page on GitHub
  Pages has no API; the page calculates locally and says so.
*/
(function () {
  var host = location.hostname;
  var local = host === "localhost" || host === "127.0.0.1" || host === "";
  var override = new URLSearchParams(location.search).get("api");
  var base = override || (local ? "http://localhost:3001" : "/api");
  window.EV_CONFIG = { apiBase: base.replace(/\/$/, "") };
})();
