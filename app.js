const express = require('express');
const https = require('https');
const app = express();

app.use(function(req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

var cachedToken = null;
var tokenExpiry = 0;

function getToken(callback) {
  if (cachedToken && Date.now() < tokenExpiry) return callback(null, cachedToken);
  var clientId = process.env.EBAY_CLIENT_ID || 'RoyBaibu-NIKONTRA-PRD-68f86d25c-9c75ece5';
  var clientSecret = process.env.EBAY_CLIENT_SECRET || 'PRD-8f86d25c879e-5ab1-44d7-b5a7-576b';
  var credentials = Buffer.from(clientId + ':' + clientSecret).toString('base64');
  var body = 'grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope';
  var options = {
    hostname: 'api.ebay.com',
    path: '/identity/v1/oauth2/token',
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + credentials,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(body)
    }
  };
  var req = https.request(options, function(response) {
    var data = '';
    response.on('data', function(chunk) { data += chunk; });
    response.on('end', function() {
      try {
        var json = JSON.parse(data);
        if (json.access_token) {
          cachedToken = json.access_token;
          tokenExpiry = Date.now() + (json.expires_in - 60) * 1000;
          callback(null, cachedToken);
        } else {
          callback('Token error: ' + data);
        }
      } catch(e) { callback(e.message); }
    });
  });
  req.on('error', function(e) { callback(e.message); });
  req.write(body);
  req.end();
}

app.get('/debug', function(req, res) {
  getToken(function(err, token) {
    if (err) return res.json({ tokenError: err });
    res.json({ tokenOK: true, tokenPreview: token.slice(0, 30) });
  });
});

app.get('/ebay-price', function(req, res) {
  var query = req.query.q;
  if (!query) return res.json({ error: 'no query' });
  getToken(function(err, token) {
    if (err) return res.json({ error: err, low: null, avg: null, high: null, count: 0 });
    var path = '/buy/browse/v1/item_summary/search?q=' + encodeURIComponent(query) + '&limit=10&sort=price';
    var options = {
      hostname: 'api.ebay.com',
      path: path,
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + token,
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
        'Content-Type': 'application/json'
      }
    };
    var request = https.request(options, function(response) {
      var data = '';
      response.on('data', function(chunk) { data += chunk; });
      response.on('end', function() {
        try {
          var json = JSON.parse(data);
          var items = json.itemSummaries || [];
          var prices = [];
          for (var i = 0; i < items.length; i++) {
            var p = items[i].price;
            if (p && p.value) {
              var val = parseFloat(p.value);
              if (val > 0) prices.push(val);
            }
          }
          if (!prices.length) return res.json({ low: null, avg: null, high: null, count: 0, raw: json });
          prices.sort(function(a, b) { return a - b; });
          var avg = prices.reduce(function(s, v) { return s + v; }, 0) / prices.length;
          res.json({ low: Math.round(prices[0]), avg: Math.round(avg), high: Math.round(prices[prices.length - 1]), count: prices.length });
        } catch(e) { res.json({ error: e.message, low: null, avg: null, high: null, count: 0 }); }
      });
    });
    request.on('error', function(e) { res.json({ error: e.message, low: null, avg: null, high: null, count: 0 }); });
    request.end();
  });
});

app.get('/', function(req, res) {
  res.send('Nikon proxy is running - Browse API');
});

var port = process.env.PORT || 3000;
app.listen(port, function() {
  console.log('Nikon proxy listening on port ' + port);
});


app.use(function(req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

var cachedToken = null;
var tokenExpiry = 0;

function getToken(callback) {
  if (cachedToken && Date.now() < tokenExpiry) return callback(null, cachedToken);
  var clientId = process.env.EBAY_CLIENT_ID || 'RoyBaibu-NIKONTRA-PRD-68f86d25c-9c75ece5';
  var clientSecret = process.env.EBAY_CLIENT_SECRET || 'PRD-8f86d25c879e-5ab1-44d7-b5a7-576b';
  var credentials = Buffer.from(clientId + ':' + clientSecret).toString('base64');
  var body = 'grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope';
  var options = {
    hostname: 'api.ebay.com',
    path: '/identity/v1/oauth2/token',
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + credentials,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(body)
    }
  };
  var req = https.request(options, function(response) {
    var data = '';
    response.on('data', function(chunk) { data += chunk; });
    response.on('end', function() {
      try {
        var json = JSON.parse(data);
        if (json.access_token) {
          cachedToken = json.access_token;
          tokenExpiry = Date.now() + (json.expires_in - 60) * 1000;
          callback(null, cachedToken);
        } else {
          callback('Token error: ' + data);
        }
      } catch(e) { callback(e.message); }
    });
  });
  req.on('error', function(e) { callback(e.message); });
  req.write(body);
  req.end();
}

app.get('/ebay-price', function(req, res) {
  var query = req.query.q;
  if (!query) return res.json({ error: 'no query' });
  getToken(function(err, token) {
    if (err) return res.json({ error: err, low: null, avg: null, high: null, count: 0 });
    var path = '/buy/browse/v1/item_summary/search?q=' + encodeURIComponent(query) + '&limit=10&sort=price';
    var options = {
      hostname: 'api.ebay.com',
      path: path,
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + token,
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
        'Content-Type': 'application/json'
      }
    };
    var request = https.request(options, function(response) {
      var data = '';
      response.on('data', function(chunk) { data += chunk; });
      response.on('end', function() {
        try {
          var json = JSON.parse(data);
          var items = json.itemSummaries || [];
          var prices = [];
          for (var i = 0; i < items.length; i++) {
            var p = items[i].price;
            if (p && p.value) {
              var val = parseFloat(p.value);
              if (val > 0) prices.push(val);
            }
          }
          if (!prices.length) return res.json({ low: null, avg: null, high: null, count: 0 });
          prices.sort(function(a, b) { return a - b; });
          var avg = prices.reduce(function(s, v) { return s + v; }, 0) / prices.length;
          res.json({ low: Math.round(prices[0]), avg: Math.round(avg), high: Math.round(prices[prices.length - 1]), count: prices.length });
        } catch(e) { res.json({ error: e.message, low: null, avg: null, high: null, count: 0 }); }
      });
    });
    request.on('error', function(e) { res.json({ error: e.message, low: null, avg: null, high: null, count: 0 }); });
    request.end();
  });
});

app.get('/', function(req, res) {
  res.send('Nikon proxy is running - Browse API');
});

var port = process.env.PORT || 3000;
app.listen(port, function() {
  console.log('Nikon proxy listening on port ' + port);
});
