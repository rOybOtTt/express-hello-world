const express = require('express');
const https = require('https');
const app = express();

app.use(function(req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

app.get('/ebay-price', function(req, res) {
  var query = req.query.q;
  if (!query) return res.json({ error: 'no query' });
  var appId = process.env.EBAY_APP_ID || 'RoyBaibu-NIKONTRA-PRD-68f86d25c-9c75ece5';
  var path = '/services/search/FindingService/v1?OPERATION-NAME=findItemsByKeywords&SERVICE-VERSION=1.0.0&SECURITY-APPNAME=' + appId + '&RESPONSE-DATA-FORMAT=JSON&REST-PAYLOAD&keywords=' + encodeURIComponent(query) + '&sortOrder=PricePlusShippingLowest&paginationInput.entriesPerPage=10';
  var options = { hostname: 'svcs.ebay.com', path: path, method: 'GET' };
  var request = https.request(options, function(response) {
    var data = '';
    response.on('data', function(chunk) { data += chunk; });
    response.on('end', function() {
      try {
        var json = JSON.parse(data);
        var resp = json.findItemsByKeywordsResponse;
        var items = (resp && resp[0] && resp[0].searchResult && resp[0].searchResult[0] && resp[0].searchResult[0].item) ? resp[0].searchResult[0].item : [];
        var prices = [];
        for (var i = 0; i < items.length; i++) {
          var ss = items[i].sellingStatus;
          var pv = (ss && ss[0] && ss[0].currentPrice && ss[0].currentPrice[0]) ? parseFloat(ss[0].currentPrice[0].__value__) : 0;
          if (pv > 0) prices.push(pv);
        }
        if (!prices.length) return res.json({ low: null, avg: null, high: null, count: 0 });
        prices.sort(function(a, b) { return a - b; });
        var avg = prices.reduce(function(s, v) { return s + v; }, 0) / prices.length;
        res.json({ low: Math.round(prices[0]), avg: Math.round(avg), high: Math.round(prices[prices.length - 1]), count: prices.length });
      } catch(e) { res.json({ error: e.message }); }
    });
  });
  request.on('error', function(e) { res.json({ error: e.message }); });
  request.end();
});

app.get('/', function(req, res) {
  res.send('Nikon proxy is running');
});

var port = process.env.PORT || 3000;
app.listen(port, function() {
  console.log('Nikon proxy listening on port ' + port);
});
