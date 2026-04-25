const express = require('express');
const https = require('https');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
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
  var options = { hostname:'api.ebay.com', path:'/identity/v1/oauth2/token', method:'POST', headers:{'Authorization':'Basic '+credentials,'Content-Type':'application/x-www-form-urlencoded','Content-Length':Buffer.byteLength(body)} };
  var req = https.request(options, function(response) {
    var data = '';
    response.on('data', function(chunk) { data += chunk; });
    response.on('end', function() {
      try {
        var json = JSON.parse(data);
        if (json.access_token) { cachedToken = json.access_token; tokenExpiry = Date.now() + (json.expires_in - 60) * 1000; callback(null, cachedToken); }
        else { callback('Token error: ' + data); }
      } catch(e) { callback(e.message); }
    });
  });
  req.on('error', function(e) { callback(e.message); });
  req.write(body); req.end();
}

app.get('/ebay-price', function(req, res) {
  var query = req.query.q;
  if (!query) return res.json({ error: 'no query' });
  getToken(function(err, token) {
    if (err) return res.json({ error: err, low: null, avg: null, high: null, count: 0 });
    var p2 = '/buy/browse/v1/item_summary/search?q=' + encodeURIComponent(query) + '&limit=10&sort=price';
    var options = { hostname:'api.ebay.com', path:p2, method:'GET', headers:{'Authorization':'Bearer '+token,'X-EBAY-C-MARKETPLACE-ID':'EBAY_US','Content-Type':'application/json'} };
    var request = https.request(options, function(response) {
      var data = '';
      response.on('data', function(chunk) { data += chunk; });
      response.on('end', function() {
        try {
          var json = JSON.parse(data);
          var items = json.itemSummaries || [];
          var prices = [];
          for (var i = 0; i < items.length; i++) { var p = items[i].price; if (p && p.value) { var val = parseFloat(p.value); if (val > 0) prices.push(val); } }
          if (!prices.length) return res.json({ low: null, avg: null, high: null, count: 0 });
          prices.sort(function(a, b) { return a - b; });
          var avg = prices.reduce(function(s, v) { return s + v; }, 0) / prices.length;
          res.json({ low: Math.round(prices[0]), avg: Math.round(avg), high: Math.round(prices[prices.length-1]), count: prices.length });
        } catch(e) { res.json({ error: e.message, low: null, avg: null, high: null, count: 0 }); }
      });
    });
    request.on('error', function(e) { res.json({ error: e.message, low: null, avg: null, high: null, count: 0 }); });
    request.end();
  });
});

app.post('/api/claude', function(req, res) {
  var prompt = req.body.prompt;
  var system = req.body.system || 'You are a helpful assistant.';
  var apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.json({ error: 'No API key', text: '[]' });
  var body = JSON.stringify({ model:'claude-sonnet-4-20250514', max_tokens:1000, system:system, messages:[{role:'user',content:prompt}] });
  var options = { hostname:'api.anthropic.com', path:'/v1/messages', method:'POST', headers:{'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01','Content-Length':Buffer.byteLength(body)} };
  var request = https.request(options, function(response) {
    var data = '';
    response.on('data', function(chunk) { data += chunk; });
    response.on('end', function() {
      try { var json = JSON.parse(data); var text = (json.content && json.content[0] && json.content[0].text) ? json.content[0].text : '[]'; res.json({ text: text }); }
      catch(e) { res.json({ error: e.message, text: '[]' }); }
    });
  });
  request.on('error', function(e) { res.json({ error: e.message, text: '[]' }); });
  request.write(body); request.end();
});

// ── SEED DATA ──────────────────────────────────────────────────────────────
app.get('/api/seed', function(req, res) {
  var LISTED = [
    {n:"[TOP MINT in Box] Nikon MD-14 Motor Drive for Nikon FG / EM SLR Japan Unused",p:""},
    {n:"[TOP MINT in Box] Nikon Nikkor AIS 24mm f/2.8 Wide-angle Lens From Japan",p:""},
    {n:"[Top Mint in Box] Nikon MB-1 Battery Pack for MD-1 MD-2 MD-3 Motor Drives Japan",p:"149.99"},
    {n:"[TOP MINT in Box] Nikon MD-15 Motor Drive for Nikon FA Camera from Japan",p:"119.99"},
    {n:"[TOP MINT in Grey Box] Nikon MD-11 Motor Drive for Nikon FM from Japan Special",p:"119.99"},
    {n:"[UNUSED in Box] Nikon Nikkor 43mm O56 Orange Filter Silver Rim Nippon Kogaku",p:"109.00"},
    {n:"[UNUSED in Box] Nikon Nikkor 43mm R60 Red Filter Silver Rim Nippon Kogaku Japan",p:"139.00"},
    {n:"[UNUSED in Case + Box] Nippon Kogaku Nikon 52mm Polarizing Filter Leather Case",p:"39.99"},
    {n:"[UNUSED in Case + Box] Nikon 52mm Polarizing Filter Silver Box Version w Papers",p:"39.99"},
    {n:"[UNUSED in Case + Box] Nikon Nikkor 52mm L1A Skylight Filter Nippon Kogaku Japan",p:"29.99"},
    {n:"[UNUSED in Case + Box] Nikon Nikkor 52mm L39 UV Haze Filter Nippon Kogaku Japan",p:"29.99"},
    {n:"[UNUSED in Case + Box] Nikon 52mm L37 UV Haze Filter w Case Papers Japan",p:"29.99"},
    {n:"[UNUSED in Case + Box] Nikon 46mm L37 UV Haze Filter w Case Papers Japan",p:"34.99"},
    {n:"[UNUSED in Box] Nikon Nikkor 40.5mm Y48 Yellow Filter Silver Rim Nippon Kogaku",p:"39.99"},
    {n:"[UNUSED in Box] Nikon Nikkor 40.5mm A12 Amber Filter Silver Rim Nippon Kogaku",p:"39.99"},
    {n:"[UNUSED in Box] Nikon 39mm O56 Orange Lens Filter Logo Pattern Box From Japan",p:"34.99"},
    {n:"[UNUSED in Box] Nikon 39mm B8 Blue Lens Filter Logo Pattern Box From Japan",p:"34.99"},
    {n:"[UNUSED in Box] Nikon Nikkor 40.5mm Y52 Yellow Filter Silver Rim Nippon Kogaku",p:"39.99"},
    {n:"[UNUSED in Case + Box] Original Nikon 52mm Y44 Yellow Filter w Case From Japan",p:"29.99"},
    {n:"[UNUSED in Case + Box] Original Nikon 52mm X1 Green Filter w Case Papers",p:"29.99"},
    {n:"[UNUSED in Box] Nikon Bayonet Type Y48 Yellow Filter Blue Logo Pattern Box Japan",p:"44.99"},
    {n:"[UNUSED in Box] Nikon Bayonet Type A2 Amber Filter w Logo Pattern Box Japan",p:"39.99"},
    {n:"[UNUSED in Case + Box] Nikon 52mm ND4X Neutral Density Filter w Case From Japan",p:"34.99"},
    {n:"[UNUSED in Case + Box] Nikon Inc NY 52mm No 1A Skylight Filter Made in USA",p:"24.99"},
    {n:"[UNUSED in Case + Box] Nikon Inc NY 40.5mm No 85 Warming Filter Made in USA",p:"24.99"},
    {n:"[TOP MINT in Box] Nikon MF-19 Multi Data Back for Nikon F-301 N2000 SLR Camera",p:"69.99"},
    {n:"[Top Mint in Box] Nikon MF-12 Data Back for Nikon F3 F3H SLR Quartz Date",p:"117.00"},
    {n:"[Top Mint in Box] Nikon MF-14 Multi Battery Adapter for Nikon F3 F3H film Camera",p:"89.99"},
    {n:"[TOP MINT in Box] Nikon FB-E Hard Compartment Case for Nikon EM Series E System",p:"99.50"},
    {n:"[EXC+] Nikon FB-5 Camera Lens Bag Clean Exterior Good Interior No Box",p:"114.50"},
    {n:"[TOP MINT in Box] Nikon Foam Rubber Compartment Case Model-2 SLR Lens Bag",p:"59.99"},
    {n:"[TOP MINT in Box] Nikon MF-22 Data Back for F4 F4S Rare USA Export Version",p:"89.50"},
    {n:"[TOP MINT in Box] Nikon MF-16 Data Back for Nikon FM2 FE2 FA USA Export",p:"144.00"},
    {n:"[TOP MINT in Box] Nikon MD-4 Motor Drive for Nikon F3 from Japan UNOPENED",p:"229.00"},
    {n:"[TOP MINT in Box] Nikon MD-2 Motor Drive for Nikon F2 from Japan UNOPENED",p:"199.99"},
    {n:"[TOP MINT in Box] Nikon MD-E Auto Winder for Nikon EM FG SLR Japan Unused",p:"62.99"},
    {n:"[TOP MINT in Box] Nikon MB-D11 Multi-Power Battery Grip for D7000 DSLR Unused",p:"89.99"},
    {n:"[TOP MINT in Box] Nikon MB-10 Battery Pack Grip for Nikon F90X N90S SLR NEW",p:"94.00"},
    {n:"[TOP MINT in Box] Nikon MB-23 Battery Pack for Nikon F4 F4S SLR Japan Unused",p:"79.99"},
    {n:"[TOP MINT in Box] Nikon BC-7 Flash Unit for Nikon SLR Cameras Japan Unused",p:"84.50"},
    {n:"[TOP MINT in Box] Nikon Pistol Grip Model S for Nikon F F2 F3 Japan Unused",p:"61.99"},
    {n:"[TOP MINT in Box] Nippon Kogaku Nikon BC-IV BC-4 Flash for Nikon S2 Unused",p:"119.50"},
    {n:"[TOP MINT in Box] Nikon F-36 Motor Drive for Nikon F SLR camera Japan Unused",p:"399.99"},
    {n:"[Top Mint in Box] Nikon MB-16 Battery Pack Grip for Nikon N80 F80 Camera",p:"69.99"},
    {n:"[TOP MINT in Box] Nikon MD-3 Motor Drive for Nikon F2 series from Japan UNOPENED",p:"179.99"},
    {n:"[TOP MINT in Box] Nikon MB-18 Battery Pack for Nikon F75 N75 U2 Japan UNOPENED",p:"59.99"},
    {n:"[UNUSED in Box] Nikon MB-21 High-Speed Battery Pack for Nikon F4 F4S SLR Japan",p:"189.99"},
    {n:"[TOP MINT in Case + Box] Nikon 122mm L37C UV Haze Filter w Nikon Logo Box Japan",p:"114.00"},
    {n:"[UNUSED in Case + Box] Nikon 95mm L37C UV Haze Filter w Nikon Logo Box Japan",p:"89.99"},
    {n:"[Rare] [UNUSED in Case + Box] Nikon 122mm R60 Red Filter w Nikon Logo Box Japan",p:"150.00"},
    {n:"[UNUSED in Case + Box] Nikon 62mm A12 Amber Warming Filter Case Papers Japan",p:"20.74"},
    {n:"[UNUSED in Case + Box] Nikon 62mm B2 Blue Filter with Case Papers Japan NEW",p:"21.74"},
    {n:"[UNUSED in Case + Box] Nikon NC 77mm Filter w Case Box Papers Japan NEW",p:"38.00"},
    {n:"[Rare] [UNUSED in Case + Box] Nikon 72mm R60 Red Filter w Case Papers Japan",p:"89.00"},
    {n:"[UNUSED in Case + Box] Nikon 62mm B2 82A Blue Filter Case Papers US Export",p:"29.00"},
    {n:"[UNUSED in Case + Box] Nikon NC 72mm Filter w Case Box Papers Japan NEW",p:"35.00"},
    {n:"[UNUSED in Case + Box] Nikon NC 52mm Filter w Case Box Papers Japan NEW",p:"28.00"},
    {n:"[UNUSED in Case + Box] Nikon NC 67mm Filter w Case Box Papers Japan NEW",p:"32.00"},
    {n:"[UNUSED in Case + Box] Nikon 62mm L37C UV Haze Filter w Case Papers Japan",p:"32.00"},
    {n:"[UNUSED in Case + Box] Nikon 52mm L1Bc Clear Skylight Filter w Papers US Export",p:"27.00"},
    {n:"[UNUSED in Case + Box] Nikon 52mm Soft Focus No1 Filter w Papers US Export",p:"25.99"},
    {n:"[UNUSED in Case + Box] Nikon 72mm Circular Polarizing Filter w Case Papers",p:"39.75"},
    {n:"[UNUSED in Case + Box] Nikon Nikkor 52mm B8 Blue Filter Nippon Kogaku Japan",p:"24.99"},
    {n:"[UNUSED in Case + Box] Nikon Nikkor 52mm A2 Amber Filter Nippon Kogaku Japan",p:"23.49"},
    {n:"[UNUSED in Case + Box] Nikon Nikkor 52mm X0 Green Filter Nippon Kogaku Japan",p:"24.99"},
    {n:"[UNUSED in Box] Nikon Nikkor 52mm O56 Orange Filter Nippon Kogaku from Japan",p:"26.74"},
    {n:"[UNUSED in Case + Box] Nikon 52mm B2 Blue Filter with Case Papers Japan NEW",p:"21.74"},
    {n:"[UNUSED in Case + Box] Nikon 52mm A12 Amber Warming Filter Case Papers Japan",p:"20.74"},
    {n:"[UNUSED in Case + Box] Nikon 52mm R60 Red Contrast Filter w Case Papers Japan",p:"34.99"},
    {n:"[UNUSED in Case + Box] Nikon 52mm Soft Focus No2 Filter w Papers US Export",p:"34.99"},
    {n:"[UNUSED in Case + Box] Nikon 52mm Soft-2 Soft Focus Filter w Case Papers",p:"34.99"},
    {n:"[UNUSED in Case + Box] Original Nikon 52mm X0 Green Filter w Case Papers",p:"24.49"},
    {n:"[UNUSED in Case + Box] Nikon 52mm X0 Green Filter Silver Late Version w Papers",p:"24.49"},
    {n:"[UNUSED in Case + Box] Original Nikon 52mm O56 Orange Filter w Case Papers",p:"24.49"},
    {n:"[UNUSED in Case + Box] Nikon 52mm L1BC Clear Skylight Filter w Case Papers",p:"24.49"},
    {n:"[UNUSED in Box] Nikon Nikkor 52mm Y48 Yellow Filter Nippon Kogaku from Japan",p:"31.49"},
    {n:"[UNUSED in Case + Box] Nikon 52mm Y48 Yellow Filter from Japan w Case Papers",p:"31.00"},
    {n:"[UNUSED in Case + Box] Nikon 52mm Y48 Yellow Filter Late Version w Papers Japan",p:"33.50"},
    {n:"[UNUSED in Case + Box] Original Nikon 52mm Polarizing Filter w Case Papers",p:"29.50"},
    {n:"[Top Mint in Box] Nikon Cordless Battery Pack for F-36 Motor Drive from Japan",p:"349.99"},
    {n:"[TOP MINT in Box] Nikon Nikkor AIS 35mm f/2.8 Wide-angle Lens From Japan",p:"334.50"},
    {n:"[TOP MINT in Box] Nikon MF-15 Data Back for Nikon FG SLR Camera Quartz Date",p:"99.50"}
  ];

  var DRAFTS = [
    {n:"[TOP MINT in Box] Nikon Extension Ring Model E2 for Nikon F Nippon Kogaku Japan",p:"29.99"},
    {n:"[TOP MINT] Nikon MD-3 Motor Drive for Nikon F2 w MB-2 Battery Pack Grey Box",p:"169.99"},
    {n:"[UNUSED in Case + Box] Nikon Close-Up Attachment No 2 3.0 Diopter w Papers",p:"34.99"},
    {n:"[ULTRA RARE +TOP MINT] Nikon F3H + MD-4H High-Speed Package 35mm SLR Film Camera",p:"5700.00"},
    {n:"[ULTRA RARE] Nikon F3 HP Lapita 99/100 35mm SLR Film Camera TOP MINT + BOX",p:"5500.00"},
    {n:"[ULTRA RARE] Nikon F3/T champagne 240/300 WOOD BOX special edition TOP MINT",p:"2200.00"},
    {n:"[ULTRA RARE] Nikon FM2/T YEAR OF THE DOG 199/300 35mm SLR Film Camera UNUSED",p:"4500.00"},
    {n:"[TOP MINT] Nikon F5 35mm SLR Film Camera From JAPAN in NEW condition",p:"530.00"}
  ];

  var SOLD_DATA = [
    {n:"Nikon Cordless Battery Pack for F-36 Motor Drive from Japan",s:"399.99",d:"2026-04-14"},
    {n:"Nikon MB-21 High-Speed Battery Pack for Nikon F4 F4S SLR Japan",s:"215.00",d:"2026-04-11"},
    {n:"Nikon F-36 Motor Drive for Nikon F Logo Pattern Box Unused",s:"479.99",d:"2026-03-29"},
    {n:"Nikon Nikkor AIS 35mm f/2.8 Wide-angle Lens From Japan",s:"310.00",d:"2026-03-11"},
    {n:"Nikon Nikkor AI 35mm f/2.8 Wide-angle Lens From Japan",s:"310.00",d:"2026-02-14"},
    {n:"Nikon MF-14 Multi Battery Adapter for Nikon F3/F3H film Camera",s:"135.00",d:"2026-02-12"},
    {n:"Nikon F-36 Motor Drive for Nikon F Logo Pattern Box Unused 2nd",s:"479.99",d:"2026-02-10"},
    {n:"Nikon MB-D11 Multi-Power Battery Grip for D7000 DSLR Unused",s:"89.99",d:"2026-02-01"},
    {n:"Nikon MD-2 Motor Drive for Nikon F2 from Japan UNOPENED",s:"199.00",d:"2026-01-26"},
    {n:"Nikon Foam Rubber Compartment Case Model-2 SLR Lens Bag",s:"149.00",d:"2026-01-22"},
    {n:"Nikon MB-16 Battery Pack Grip for Nikon N80 F80 Camera",s:"100.00",d:"2026-01-02"},
    {n:"Nikon MF-18 Motor Drive Adapter for Nikon F3 F3H SLR Camera",s:"170.99",d:"2025-12-18"},
    {n:"Nikon MH-30 Battery Charger for Nikon F5 From Japan UNOPENED",s:"135.00",d:"2025-09-09"},
    {n:"Nikon AF Nikkor 28-80mm f/3.3-5.6G Zoom Lens UNOPENED",s:"112.00",d:"2025-09-05"},
    {n:"Nikon MD-15 Motor Drive for Nikon FA from Japan UNOPENED",s:"148.00",d:"2025-08-20"},
    {n:"Nikon Nikkormat FTN 35mm SLR Film Camera From JAPAN UNUSED",s:"450.00",d:"2025-08-20"},
    {n:"Nikon MD-4 Motor Drive for Nikon F3 from Japan UNOPENED",s:"205.00",d:"2025-07-01"},
    {n:"Nikon AF Zoom-Nikkor 70-300mm f/4-5.6G Lens Japan",s:"150.00",d:"2025-06-28"},
    {n:"Nikon F5 35mm SLR Film Camera From JAPAN NEW condition",s:"650.00",d:"2025-06-25"},
    {n:"Nikon AF Zoom-Nikkor 28-105mm f/3.5-4.5D IF Lens Japan",s:"120.00",d:"2025-06-06"},
    {n:"Nikon Nikkor AIS 28mm f/2.8 Wide-angle Lens From Japan UNOPENED",s:"375.00",d:"2025-06-06"},
    {n:"Nikon Nikkor AIS 50mm f/1.8 Portrait Lens From Japan UNOPENED",s:"165.00",d:"2025-05-31"},
    {n:"Nikon MD-3 Motor Drive for Nikon F2 from Japan UNUSED",s:"200.00",d:"2025-05-28"},
    {n:"Nikon MB-1 Battery Pack for F2 MD-1 MD-2 MD-3 Motor Drive JAPAN",s:"40.00",d:"2025-05-27"},
    {n:"Nikon F100 35mm SLR Film Camera From JAPAN NEW condition",s:"470.00",d:"2025-04-08"},
    {n:"Custom Nikon FM GOLD LIZARD SKIN 35mm SLR Film Camera",s:"1575.00",d:"2025-02-27"},
    {n:"Nikon F2 Photomic A Data 35mm SLR Film Camera Nikkor 35mm",s:"2200.00",d:"2025-02-26"},
    {n:"Nikon F2S Silver 35mm SLR Film Camera NEW condition",s:"1350.00",d:"2025-02-06"},
    {n:"Nikon FM2/T YEAR OF THE DOG 144/300 35mm SLR Film Camera",s:"2700.00",d:"2025-02-01"},
    {n:"Nikon F2 photomic BIG BOX WITH LENS perfect condition",s:"1377.50",d:"2025-01-23"},
    {n:"Nikon F3/T champagne nikkor-H Auto Non-Ai 85mm F1.8",s:"1600.00",d:"2024-12-02"},
    {n:"Nikon F2 photomic SB INTACT condition",s:"1350.00",d:"2024-09-05"},
    {n:"Nikon FM2 silver 35mm SLR Film Camera FLAWLESS condition",s:"650.00",d:"2024-09-01"},
    {n:"Nikon F2S Silver 35mm SLR Film Camera NEW condition",s:"1350.00",d:"2024-05-23"},
    {n:"Custom Nikon F GOLD LIZARD SKIN 35mm SLR Film Camera",s:"1500.00",d:"2024-05-22"},
    {n:"Nikon F4E 35mm SLR Film Camera From JAPAN NEW condition",s:"808.00",d:"2024-05-08"},
    {n:"Nikon F2 photomic SB Black INTACT condition",s:"925.00",d:"2024-04-04"},
    {n:"Nikon F3P HP 35mm SLR Film PRESS Camera High Eyepoint NEW",s:"950.00",d:"2024-03-24"},
    {n:"Nikon F3/T HP champagne PERFECT condition",s:"1450.00",d:"2024-03-21"},
    {n:"Nikon F2S Black 35mm SLR Film Camera NEW condition",s:"1350.00",d:"2024-03-10"},
    {n:"Nikon F2AS 35mm SLR Film Camera NEW condition RARE",s:"1700.00",d:"2024-03-06"},
    {n:"Nikon FM silver 35mm SLR Film Camera FLAWLESS condition",s:"160.00",d:"2024-03-03"},
    {n:"Nikon Nikkormat FT2 35mm SLR Film Camera NEW condition",s:"427.50",d:"2024-02-26"},
    {n:"Nikon F2 AS black perfect condition",s:"1200.00",d:"2024-02-24"},
    {n:"Nikon F4S 35mm SLR Film Camera From JAPAN NEW condition",s:"450.00",d:"2024-01-04"},
    {n:"Nikon Nikomat FTN 35mm SLR Film Camera Nikkor 50mm F2",s:"550.00",d:"2024-01-04"},
    {n:"Nikon Nikkor Non-Ai 85mm F/1.8 Portrait Lens FLAWLESS condition",s:"320.00",d:"2024-01-02"},
    {n:"Nikon F photonic FTN black perfect condition",s:"760.00",d:"2023-12-10"},
    {n:"Nikon F2/T No Name 35mm SLR Film Camera MINT+ condition",s:"1250.00",d:"2023-11-26"},
    {n:"Nikon FT2 silver 35mm SLR Film Camera",s:"340.00",d:"2023-11-22"},
    {n:"Nikon F photonic FTN and nikkormat FTN both black perfect condition",s:"1275.00",d:"2023-10-06"},
    {n:"Nikon FE silver 35mm SLR Film Camera NEW condition",s:"580.00",d:"2023-09-04"},
    {n:"Nikon FA camera MINT condition",s:"495.00",d:"2023-08-11"},
    {n:"Nikon EL2 Black 35mm SLR Film Camera MINT+ condition",s:"260.00",d:"2023-07-01"},
    {n:"Nikon EL2 silver 35mm SLR Film Camera MINT+ condition",s:"1350.00",d:"2023-05-12"},
    {n:"Nikon F2S Silver 35mm SLR Film Camera NEW condition",s:"1350.00",d:"2023-05-12"},
    {n:"Nikon F2/T No Name 35mm SLR Film Camera NEW condition",s:"3200.00",d:"2023-03-28"},
    {n:"Nikon FE2 Black Body Titanium Shutter 35mm SLR Film Camera",s:"890.00",d:"2023-03-24"},
    {n:"Nikon FM2N silver 35mm SLR Film Camera NEW condition",s:"800.00",d:"2023-03-04"},
    {n:"Nikon FE2 Silver 35mm SLR Film Camera NEW condition",s:"810.00",d:"2023-02-08"},
    {n:"Nikon FM2N black 35mm SLR Film Camera NEW condition",s:"900.00",d:"2023-01-19"},
    {n:"Nikon F2 photomic AS 35mm SLR Film Camera NEW condition",s:"680.00",d:"2022-12-25"},
    {n:"Nikon FM2N Black 35mm SLR Film Camera NEW condition",s:"950.00",d:"2022-10-26"},
    {n:"Nikon 28Ti Black Point Shoot Film Camera NEW condition",s:"1350.00",d:"2022-10-04"},
    {n:"Nikon 35Ti Point Shoot Film Camera NEW condition",s:"1250.00",d:"2022-10-04"},
    {n:"Nikon New F2 Photomic A Silver 35mm SLR Film Camera",s:"1000.00",d:"2022-10-04"},
    {n:"Nikkor F/1.4 50mm AIS MINT+++ condition",s:"310.00",d:"2022-10-04"},
    {n:"Nikon F6 35mm SLR Camera Brand New Never opened",s:"2600.00",d:"2022-10-04"},
    {n:"Nikon 35Ti Point Shoot Film Camera NEW condition",s:"1000.00",d:"2022-10-01"},
    {n:"Nikon New F2 Photomic A Silver 35mm SLR Film Camera",s:"1050.00",d:"2022-07-16"},
    {n:"Nikon FG black body MINT condition never used",s:"120.00",d:"2022-05-05"},
    {n:"Nikon FM2 black body never used or opened",s:"650.00",d:"2022-03-23"},
    {n:"Nikkor F/2 50mm AI MINT condition original box papers",s:"200.00",d:"2022-02-12"},
    {n:"Nikon FM3A silver body MINT condition never used",s:"1200.00",d:"2022-01-29"},
    {n:"Nikon N2020 F-501 SLR Camera Never used",s:"50.00",d:"2022-02-03"},
    {n:"Nikon F2A Photomic Silver 35mm SLR Camera Never used",s:"550.00",d:"2022-01-31"},
    {n:"Nikon N2020 F-501 SLR Camera Never used",s:"60.00",d:"2022-01-30"},
    {n:"Nikon FM3A silver body MINT condition never used",s:"1100.00",d:"2022-01-29"},
    {n:"Nikon FM2 black body MINT condition never used",s:"720.00",d:"2021-10-08"},
    {n:"Nikkor F/1.2 50mm AIS MINT condition never used",s:"580.00",d:"2021-09-06"},
    {n:"Nikon F90X black body SLR Film MINT condition",s:"145.00",d:"2021-06-26"},
    {n:"Nikon EM Black body 35mm SLR Film Full Package never opened",s:"160.00",d:"2021-05-27"},
    {n:"Nikon FE camera SLR",s:"500.00",d:"2021-04-14"},
    {n:"Nikon BLACK FG 35mm SLR Film Camera Body",s:"130.00",d:"2020-12-18"},
    {n:"Nikon BLACK FG 35mm SLR Film Camera Body",s:"140.00",d:"2020-11-29"},
    {n:"Nikon EM SLR Film Camera Body Only",s:"135.00",d:"2020-11-22"}
  ];

  function pCond(n){var t=n.toUpperCase();if(t.indexOf('MINT')>=0||t.indexOf('UNUSED')>=0||t.indexOf('NEW')>=0||t.indexOf('RARE')>=0)return'Mint';if(t.indexOf('EXC')>=0)return'Good';return'Mint';}
  function pStrat(n){var t=n.toUpperCase();if(t.indexOf('ULTRA RARE')>=0||t.indexOf('LAPITA')>=0||t.indexOf('CHAMPAGNE')>=0||t.indexOf('YEAR OF THE DOG')>=0||t.indexOf('F3H')>=0)return'Hold for Premium';if(t.indexOf('FILTER')>=0||t.indexOf('BAG')>=0||t.indexOf('FLASH')>=0)return'Quick Flip';if(t.indexOf('MOTOR DRIVE')>=0||t.indexOf('MD-')>=0||t.indexOf('LENS')>=0||t.indexOf('F-36')>=0||t.indexOf('CAMERA')>=0)return'Hold for Premium';return'Quick Flip';}
  function getPMKey(name){var t=name.toUpperCase();var mm=name.match(/([A-Z]{1,3}-?\d{1,3}[A-Za-z]?)/);var model=mm?mm[1].toUpperCase():null;var sz=name.match(/(\d+mm)/);var size=sz?sz[1]:null;if(t.indexOf('FILTER')>=0&&size)return'FILTER_'+size;if((t.indexOf('MOTOR DRIVE')>=0||t.indexOf('MD-')>=0||t.indexOf('F-36')>=0)&&model)return'MOTOR_'+model;if((t.indexOf('BATTERY')>=0||t.indexOf('MB-')>=0)&&model)return'BATTERY_'+model;if((t.indexOf('DATA BACK')>=0||t.indexOf('MF-')>=0)&&model)return'DATABACK_'+model;if((t.indexOf('NIKKOR')>=0||t.indexOf('LENS')>=0)&&size)return'LENS_'+size;if(t.indexOf('FM3A')>=0)return'CAMERA_FM3A';if(t.indexOf('FM2/T')>=0)return'CAMERA_FM2T';if(t.indexOf('F3/T')>=0)return'CAMERA_F3T';if(t.indexOf('FM2')>=0)return'CAMERA_FM2';if(t.indexOf('F2AS')>=0)return'CAMERA_F2AS';if(t.indexOf('F2S')>=0)return'CAMERA_F2S';if(t.indexOf('F2')>=0)return'CAMERA_F2';if(t.indexOf('F3P')>=0)return'CAMERA_F3P';if(t.indexOf('F3')>=0)return'CAMERA_F3';if(t.indexOf('F4E')>=0||t.indexOf('F4S')>=0||t.indexOf('F4')>=0)return'CAMERA_F4';if(t.indexOf('F5')>=0)return'CAMERA_F5';if(t.indexOf('FE2')>=0)return'CAMERA_FE2';if(t.indexOf('FE')>=0)return'CAMERA_FE';if(t.indexOf('FA')>=0)return'CAMERA_FA';if(model)return'MISC_'+model;return'OTHER';}

  var items = [];
  LISTED.forEach(function(x,i){items.push({id:'L'+i,name:x.n,condition:pCond(x.n),status:'Listed',listedPrice:x.p,salePrice:'',strategy:pStrat(x.n),notes:'',dateListed:'',dateSold:''});});
  DRAFTS.forEach(function(x,i){items.push({id:'D'+i,name:x.n,condition:pCond(x.n),status:'Draft',listedPrice:x.p,salePrice:'',strategy:pStrat(x.n),notes:'',dateListed:'',dateSold:''});});
  SOLD_DATA.forEach(function(x,i){items.push({id:'S'+i,name:x.n,condition:'Mint',status:'Sold',listedPrice:'',salePrice:x.s,strategy:pStrat(x.n),notes:'',dateListed:'',dateSold:x.d});});

  var priceMemory = {};
  SOLD_DATA.forEach(function(x){var key=getPMKey(x.n);if(!priceMemory[key])priceMemory[key]=[];priceMemory[key].push({name:x.n,price:parseFloat(x.s),date:x.d});});

  res.json({ items: items, priceMemory: priceMemory });
});

app.get('/', function(req, res) {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

var port = process.env.PORT || 3000;
app.listen(port, function() {
  console.log('Nikon proxy listening on port ' + port);
});
