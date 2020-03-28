"use strict";

// Imports dependencies and set up http server
const request = require("request"),
  express = require("express"),
  bodyParser = require("body-parser"),
  app = express();

// Body parser middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Sets server port and logs message on success
app.listen(process.env.PORT || 1337, () => console.log("webhook is listening"));
var state = {};
var requests = {};
var coordinates = {};
const SERVER_URL = process.env.SERVER_URL;

// Handles messages events
async function handleMessage(sender_psid, received_message) {
  let response;

  // Check if the message contains text
  if (received_message.text) {
    //If you want to register your shop --
    if (received_message.text.indexOf("Registra") !== -1) {
      // Create the payload for a basic text message
      response = {
        text: `🏠 Bene! Adesso inviami l'indirizzo della tua attività:\n\n<nome della via>, <nome della città>, <CAP>\n\n(Es: Corso Italia 11, Roma, 00198)`
      };
      state[sender_psid] = 1;
      console.log(state);
    } else if (sender_psid in state && state[sender_psid] == 1) {
      requests[sender_psid] = received_message.text;
      console.log(requests[sender_psid]);
      callMap(sender_psid, received_message.text);
      state[sender_psid] = -1;
    } else {
      console.log(state);
      // Create the payload for a basic text message
      response = {
        text: `Ciao! Registra gratuitamente la tua attività sull'app EasyCollect digitando 'Registra'.`
      };
    }
  } else if (received_message.attachments) {
    console.log("DEBUG" + JSON.stringify(received_message.attachments));
    // TODO How to answer at the attachments
    /*
    // Gets the URL of the message attachment
    let attachment_url = received_message.attachments[0].payload.url;
    let address = received_message.attachments[0].payload.title;
    response = send_confirmation(address,'');
    */
  }
  // Sends the response message
  callSendAPI(sender_psid, response);
}

// Handles messaging_postbacks events
function handlePostback(sender_psid, received_postback) {
  let response;

  // Get the payload for the postback
  let payload = received_postback.payload;
  if (payload === "Registra" && !(sender_psid in state)) {
      // Create the payload for a basic text message
      response = {
        text: `🏠 Bene! Adesso inviami l'indirizzo della tua attività:\n\n<nome della via>, <nome della città>, <CAP>\n\n(Es: Corso Italia 11, Roma, 00198)`
      };
      state[sender_psid] = 1;
      console.log(state);
    } 
  else if (payload === "Registra2" && !(sender_psid in state)) {
      // Create the payload for a basic text message
      response = {
        text: `🏠 Ciao! Per registrarti gratuitamente inviami l'indirizzo della tua attività:\n\n<nome della via>, <nome della città>, <CAP>\n\n(Es: Corso Italia 11, Roma, 00198)`
      };
      state[sender_psid] = 1;
      console.log(state);
    }

  // Set the response based on the postback payload
  if (payload === "yes") {
    response = setDatiAttivita(sender_psid);

    // store the coordinates
  } else if (payload === "no") {
    response = { text: "Oops, riprova. Ridigita `Registra`" };
  }
  // Send the message to acknowledge the postback
  callSendAPI(sender_psid, response);
}

// Define the template to insert the main data of the shop
function setDatiAttivita(sender_psid) {
    let response = {
        attachment: {
            type: "template",
            payload: {
                template_type: "button",
                text: "📝 OK ci siamo quasi! Ora inserisci i dati principali della tua attività.",
                buttons: [{
                    type: "web_url",
                    url: SERVER_URL + "/options",
                    title: "Inserisci dati attività",
                    webview_height_ratio: "tall",
                    messenger_extensions: true
                }]
            }
        }
    };
    return response;
}

// Serve the options path for the webview
app.get('/options', (req, res, next) => {
    let referer = req.get('Referer');
    if (referer) {
        if (referer.indexOf('www.messenger.com') >= 0) {
            res.setHeader('X-Frame-Options', 'ALLOW-FROM https://www.messenger.com/');
        } else if (referer.indexOf('www.facebook.com') >= 0) {
            res.setHeader('X-Frame-Options', 'ALLOW-FROM https://www.facebook.com/');
        }
        res.sendFile('./option.html', {root: __dirname});
    }
});

// Builds the payload based on the data received from the form
function buildPayload(request_body){
    let categories = [parseInt(request_body.category1)];
    if(request_body.category2 != '') categories.push(parseInt(request_body.category2));
    if(request_body.category3 != '') categories.push(parseInt(request_body.category3));
  
    var payload = {
      "name" :  request_body.nomeattivita, 
      "address" : requests[request_body.psid],
      "description" : request_body.description, 
      "categories_ids": categories
    }
    
    // Check contacts
    if(request_body.telefono != '') payload.phone = request_body.telefono;
    if(request_body.telegram != '') payload.telegram = request_body.telegram;
    if(request_body.facebook != '') payload.facebook = request_body.facebook;
  
    console.log("PSID " + request_body.psid);
  
    return payload;
}

// Handle postback from webview. Send the post request to the BACKEND of
// the application. If success, return the message on messenger.
app.post('/optionspostback', (req, res) => {
    let body = req.query;
    var request_body = req.body;
    let payload = buildPayload(request_body);
    console.log(payload);
    
    
    request(
      {
        uri: process.env.BACKEND_URL+"/shops",
        method: "POST",
        json: payload
      },
      (err, res, body) => {
        if (!err) {
        //if (!err && res.statusCode === 200) {
          console.log(res.statusCode+": POST for shops success!");
          
          let response = {
              "text": 'Grazie, i dati della tua attività sono stati registrati.'
          };

          callSendAPI(request_body.psid, response);
          
        } else {
          console.error("Unable to send message: " + err);
        }
      }
    );
  
  res.status(200).send('Grazie! Chiudi questa finestra per ritronare alla conversazione');
});

function send_confirmation(requested_road, coordinates) {
  var coord = '';
  if(coordinates != '') coord = " con coordinate " + coordinates[0] + " e " + coordinates[1];
  var response = {
    "attachment":{
        "type":"template",
        "payload":{
          "template_type":"generic",
          "elements": [{
            "title":"E' l'indirizzo corretto?",
            "image_url": "https://cdn.glitch.com/d31a8c02-2bdb-433c-aa2c-17979565a966%2Fimage.png?v=1585216511231",
            "default_action": {
              "type": "web_url",
              "url": `https://www.google.com/maps/place/`+requested_road,
              "messenger_extensions": false,
              "webview_height_ratio": "tall",
            },
            "subtitle": requested_road + coord,
            "buttons":[
              {
                type: "postback",
                title: "Si ✅",
                payload: "yes"
              },
              {
                type: "postback",
                title: "No ❌",
                payload: "no"
              }
            ]
          }]
        }
      }
  };
  return response;
}

// Sends the reply to the user to confirm the correction of the address
function callMap(sender_psid, req) {
  var coordinates;
  console.log(
    "http://dev.virtualearth.net/REST/v1/Locations?AddressLine=" +
      req +
      "&key=" +
      process.env.MAP_TOKEN
  );
  request(
    {
      uri:
        "http://dev.virtualearth.net/REST/v1/Locations?AddressLine=" +
        req +
        "&key=" +
        process.env.MAP_TOKEN,
      method: "GET"
    },
    (err, res, body) => {
      if (!err) {
        // console.log(JSON.stringify(res));
        body = JSON.parse(body);
        coordinates =
          body["resourceSets"][0]["resources"][0]["point"]["coordinates"];
        // Create the payload for a basic text message

        var response = send_confirmation(req, coordinates);
        //state[sender_psid] = -1;
        // Sends the response message
        callSendAPI(sender_psid, response);
      } else {
        console.error("Unable to receive page:" + err);
      }
    }
  );
}

// Sends response messages via the Send API
function callSendAPI(sender_psid, response) {
  // Construct the message body
  let request_body = {
    recipient: {
      id: sender_psid
    },
    message: response
  };

  // Send the HTTP request to the Messenger Platform
  request(
    {
      uri: "https://graph.facebook.com/v2.6/me/messages",
      qs: { access_token: process.env.PAGE_ACCESS_TOKEN },
      method: "POST",
      json: request_body
    },
    (err, res, body) => {
      if (!err) {
        console.log("message sent!");
      } else {
        console.error("Unable to send message:" + err);
      }
    }
  );
}

// Accepts POST requests at /webhook endpoint
app.post("/webhook", (req, res) => {
  // Parse the request body from the POST
  let body = req.body;

  // Check the webhook event is from a Page subscription
  if (body.object === "page") {
    // Iterate over each entry - there may be multiple if batched
    body.entry.forEach(function(entry) {
      // Get the webhook event. entry.messaging is an array, but
      // will only ever contain one event, so we get index 0
      let webhook_event = entry.messaging[0];
      console.log(webhook_event);

      // Get the sender PSID
      let sender_psid = webhook_event.sender.id;
      console.log("Sender PSID: " + sender_psid);

      // Check if the event is a message or postback and
      // pass the event to the appropriate handler function
      if (webhook_event.message) {
        handleMessage(sender_psid, webhook_event.message);
      } else if (webhook_event.postback) {
        handlePostback(sender_psid, webhook_event.postback);
      }
    });

    // Return a '200 OK' response to all events
    res.status(200).send("EVENT_RECEIVED");
  } else {
    // Return a '404 Not Found' if event is not from a page subscription
    res.sendStatus(404);
  }
});

// Accepts GET requests at the /webhook endpoint
app.get("/webhook", (req, res) => {
  /** UPDATE YOUR VERIFY TOKEN **/
  const VERIFY_TOKEN = "qHAYG9u3eSON";

  // Parse params from the webhook verification request
  let mode = req.query["hub.mode"];
  let token = req.query["hub.verify_token"];
  let challenge = req.query["hub.challenge"];

  // Check if a token and mode were sent
  if (mode && token) {
    // Check the mode and token sent are correct
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      // Respond with 200 OK and challenge token from the request
      console.log("WEBHOOK_VERIFIED");
      res.status(200).send(challenge);
    } else {
      // Responds with '403 Forbidden' if verify tokens do not match
      res.sendStatus(403);
    }
  }
});
