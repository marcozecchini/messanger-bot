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
var address = "";
const SERVER_URL = process.env.SERVER_URL;

// Handles messages events
async function handleMessage(sender_psid, received_message) {
  let response;

  // Check if the message contains text
  if (received_message.text) {
    //If you want to register your shop --
    if (received_message.text.indexOf("Registra") !== -1) {
      // Create the payload for a basic text message
      requests[sender_psid] = {};
      response = setRegistraButton();

      state[sender_psid] = 0; //STATO DI REGISTRA
      console.log(state);
    } else if (sender_psid in state && state[sender_psid] == 1) {
      requests[sender_psid]["via"] = received_message.text;
      // Create the payload for a basic text message
      response = {
        text: `🌇 Adesso inviami il nome della città della tua attività`
      };
      state[sender_psid] = 2;
      console.log(state);
    } else if (sender_psid in state && state[sender_psid] == 2) {
      // Create the payload for a basic text message
      requests[sender_psid]["city"] = received_message.text;
      response = {
        text: `📍 Bene! Adesso inviami il CAP dove si trova la tua attività`
      };
      state[sender_psid] = 3; // STATO di CAP
      console.log(state);
    } else if (sender_psid in state && state[sender_psid] == 3) {
      requests[sender_psid]["CAP"] = received_message.text;
      console.log(requests[sender_psid]);
      callMap(
        sender_psid,
        requests[sender_psid]["via"] +
          "," +
          requests[sender_psid]["city"] +
          "," +
          requests[sender_psid]["CAP"]
      );
      state[sender_psid] = 4; //STATO DI YES/NO
    } else {
      console.log(state);
      // Create the payload for a basic text message
      if (state[sender_psid] !== -1) {
        response = contactMessage(
          "Ciao! 📝 Grazie di averci contattato. Provvederemo a risponderti al più presto! 😃\nIntanto consulta le `Domande frequenti` sul nostro sito oppure clicca `Registra` per registrare gratuitamente la tua attività."
        );
        state[sender_psid] = -1; //STATO DI INIZIO
      }
    }
  } else if (received_message.attachments) {
    // TODO How to answer at the attachments
    console.log(received_message.attachments);
    let type = received_message.attachments[0].type;
    let attachment_url = received_message.attachments[0].payload.url;
    let address = received_message.attachments[0].payload.title;
    if (
      type == "location" &&
      address.includes("'s Location") &&
      state[sender_psid] === 0
    ) {
      var coord1 = attachment_url.match(/[-]{0,1}[0-9]{2}[.]{1}[0-9]{1,}/);
      var coord2 = attachment_url
        .split(coord1)[1]
        .match(/[-]{0,1}[0-9]{2}[.]{1}[0-9]{1,}/);

      console.log("COORD1 = " + coord1);
      console.log("COORD2 = " + coord2);
      coord2address(sender_psid, coord1, coord2, received_message.attachments);
    } else if (
      type == "location" &&
      !address.includes("'s Location") &&
      state[sender_psid] === 0
    ) {
      response = restartRegistra(
        "Attualmente riesco solo a decifrare la tua posizione attuale. Per un indirizzo diverso inseriscilo manualmente. Premi `Registra`"
      );
      state[sender_psid] = 6; //STATO DI FINE
    } else {
      console.log(state);
      // Create the payload for a basic text message
      if (state[sender_psid] !== -1) {
        response = contactMessage(
          "Ciao! 📝 Grazie di averci contattato. Provvederemo a risponderti al più presto! 😃\nIntanto consulta le `Domande frequenti` sul nostro sito oppure clicca `Registra` per registrare gratuitamente la tua attività."
        );
        state[sender_psid] = -1; //STATO DI INIZIO
      }
    }
  }
  // Sends the response message
  callSendAPI(sender_psid, response);
}

// Handles messaging_postbacks events
function handlePostback(sender_psid, received_postback) {
  let response;

  // Get the payload for the postback
  let payload = received_postback.payload;
  if (
    (payload === "Registra" || payload === "no") &&
    state[sender_psid] !== 0
  ) {
    // Create the payload for a basic text message
    requests[sender_psid] = {};
    response = setRegistraButton();
    /*response = {
        text: `🏠 Ciao! Ti puoi registrare GRATUITAMENTE da questa chat. Vuoi inviarmi la tua posizione o inserire l'indirizzo della tua attività manualmente?`
      };*/
    state[sender_psid] = 0; //STATO DI REGISTRA
    console.log(state);
  } else if (
    (payload === "Registra2" || payload === "no") &&
    state[sender_psid] !== 0
  ) {
    // Create the payload for a basic text message
    requests[sender_psid] = {};
    response = setRegistraButton(sender_psid);
    /*response = {
        text: `🏠 Ciao! Per registrarti gratuitamente inviami il nome della via della tua attività (Es: Corso Italia 11, Viale Garibaldi 12, ...)`
      };*/
    state[sender_psid] = 0; //STATO DI REGISTRA
    console.log(state);
  }
  // Set the response based on the postback payload
  else if (payload === "man" && state[sender_psid] === 0) {
    // store the coordinates
    response = {
      text: `🏠 Bene! Adesso inviami il nome della via della tua attività (Es: Corso Italia 11, Viale Garibaldi 12, ...)`
    };
    state[sender_psid] = 1; //STATO di VIA
    console.log(state);
  }

  // Set the response based on the postback payload
  else if (payload === "yes" && state[sender_psid] === 4) {
    response = setDatiAttivita(sender_psid);
    state[sender_psid] = 5;
    // store the coordinates
  } else {
    console.log(state);
    // Create the payload for a basic text message
    if (state[sender_psid] !== -1) {
      response = contactMessage(
        "Ciao! 📝 Grazie di averci contattato. Provvederemo a risponderti al più presto! 😃\nIntanto consulta le `Domande frequenti` sul nostro sito oppure clicca `Registra` per registrare gratuitamente la tua attività."
      );
      state[sender_psid] = -1; //STATO DI INIZIO
    }
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
        text:
          "📝 OK ci siamo quasi! Ora inserisci i dati principali della tua attività.",
        buttons: [
          {
            type: "web_url",
            url: SERVER_URL + "/options",
            title: "Inserisci dati attività",
            webview_height_ratio: "tall",
            messenger_extensions: true
          }
        ]
      }
    }
  };
  return response;
}

// Define the template for registering the address manually
function setRegistraButton() {
  let response = {
    attachment: {
      type: "template",
      payload: {
        template_type: "button",
        text:
          "🏠 Ciao! Ti puoi registrare GRATUITAMENTE da questa chat. Inviami la tua posizione oppure registra manualmente l'indirizzo della tua attività",
        buttons: [
          {
            type: "postback",
            title: "Inserisci manualmente",
            payload: "man"
          }
        ]
      }
    }
  };
  return response;
}

function restartRegistra(text) {
  let response = {
    attachment: {
      type: "template",
      payload: {
        template_type: "button",
        text: text,
        buttons: [
          {
            type: "postback",
            title: "Registra",
            payload: "Registra"
          }
        ]
      }
    }
  };
  return response;
}

function contactMessage(text) {
  let response = {
    attachment: {
      type: "template",
      payload: {
        template_type: "button",
        text: text,
        buttons: [
          {
            type: "postback",
            title: "Registra",
            payload: "Registra"
          },
          {
            type: "web_url",
            url: "https://www.colligo.shop/domande-frequenti",
            title: "Domande frequenti",
            webview_height_ratio: "tall",
            messenger_extensions: true
          }
        ]
      }
    }
  };
  return response;
}

// Serve the options path for the webview
app.get("/options", (req, res, next) => {
  console.log("SENDING activity form");
  let referer = req.get("Referer");
  if (referer) {
    if (referer.indexOf("www.messenger.com") >= 0) {
      res.setHeader("X-Frame-Options", "ALLOW-FROM https://www.messenger.com/");
    } else if (referer.indexOf("www.facebook.com") >= 0) {
      res.setHeader("X-Frame-Options", "ALLOW-FROM https://www.facebook.com/");
    }
    res.sendFile("./option.html", { root: __dirname });
  }
});

// Builds the payload based on the data received from the form
function buildPayload(request_body) {
  let categories = [parseInt(request_body.category1)];
  if (request_body.category2 != "")
    categories.push(parseInt(request_body.category2));
  if (request_body.category3 != "")
    categories.push(parseInt(request_body.category3));

  var payload = {
    name: request_body.nomeattivita,
    address: requests[request_body.psid]["via"],
    city: requests[request_body.psid]["city"],
    cap: requests[request_body.psid]["CAP"],
    description: request_body.description,
    categories_ids: categories
  };

  // Check contacts
  if (request_body.telefono != "") payload.phone = request_body.telefono;
  if (request_body.telegram != "") payload.telegram = request_body.telegram;
  if (request_body.facebook != "") payload.facebook = request_body.facebook;
  if (request_body.website != "") payload.website = request_body.website;

  console.log("PSID " + request_body.psid);

  return payload;
}

// Handle postback from webview. Send the post request to the BACKEND of
// the application. If success, return the message on messenger.
app.post("/optionspostback", (req, res) => {
  let body = req.query;
  var request_body = req.body;
  let payload = buildPayload(request_body);
  console.log(payload);

  request(
    {
      uri: process.env.BACKEND_URL + "/shops",
      method: "POST",
      json: payload
    },
    (err, res, body) => {
      if (!err) {
        //if (!err && res.statusCode === 200) {
        if (res.statusCode === 419) {
          console.log(res.statusCode + ": Backend cannot solve the address!");

          let response = restartRegistra(
            "Mi dispiace ma l'indirizzo non è valido. Riprova: ridigita 'Registra' o premi il pulsante!"
          );

          callSendAPI(request_body.psid, response);
        } else if (res.statusCode === 200) {
          console.log(res.statusCode + ": POST for shops success!");

          let response = {
            text: "Grazie, i dati della tua attività sono stati registrati."
          };

          callSendAPI(request_body.psid, response);
        } else {
          console.log(res.statusCode + ": something wrong!");

          let response = restartRegistra(
            "Mi dispiace ma qualcosa è andato storto ... Riprova: ridigita 'Registra' o premi il pulsante!"
          );

          callSendAPI(request_body.psid, response);
        }
      } else {
        console.error("Unable to send message: " + err);
      }
    }
  );

  res
    .status(200)
    .send("Grazie! Chiudi questa finestra per ritronare alla conversazione");
});

function send_confirmation(requested_road, coordinates) {
  var coord = "";
  if (coordinates != "")
    coord = " con coordinate " + coordinates[0] + " e " + coordinates[1];
  var response = {
    attachment: {
      type: "template",
      payload: {
        template_type: "generic",
        elements: [
          {
            title: "E' l'indirizzo corretto?",
            image_url:
              "https://cdn.glitch.com/d31a8c02-2bdb-433c-aa2c-17979565a966%2Fimage.png?v=1585216511231",
            default_action: {
              type: "web_url",
              url: `https://www.google.com/maps/place/` + requested_road,
              messenger_extensions: false,
              webview_height_ratio: "tall"
            },
            subtitle: requested_road + coord,
            buttons: [
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
          }
        ]
      }
    }
  };
  return response;
}

// https://dev.virtualearth.net/REST/v1/LocationRecog/{point}
function coord2address(sender_psid, coord1, coord2) {
  //http://dev.virtualearth.net/REST/v1/Locations/47.64054,-122.12934?o=xml&key={BingMapsAPIKey}
  console.log(
    "http://dev.virtualearth.net/REST/v1/Locations/" +
      coord1 +
      "," +
      coord2 +
      "?key=" +
      process.env.MAP_TOKEN +
      "&output=json"
  );
  request(
    {
      uri:
        "http://dev.virtualearth.net/REST/v1/Locations/" +
        coord1 +
        "," +
        coord2 +
        "?key=" +
        process.env.MAP_TOKEN +
        "&output=json",
      method: "GET"
    },
    (err, res, body) => {
      if (!err) {
        body = JSON.parse(body);
        try {
          //console.log(JSON.stringify(body.resourceSets[0].resources[0].address.postalCode))
          address =
            body.resourceSets[0].resources[0].address.addressLine +
            ", " +
            body.resourceSets[0].resources[0].address.locality +
            ", " +
            body.resourceSets[0].resources[0].address.postalCode;

          requests[sender_psid]["via"] =
            body.resourceSets[0].resources[0].address.addressLine;
          requests[sender_psid]["city"] =
            body.resourceSets[0].resources[0].address.locality;
          requests[sender_psid]["CAP"] =
            body.resourceSets[0].resources[0].address.postalCode;

          console.log("ADDRESS = " + address);
          // Create the payload for a basic text message
          var coordinates = [coord1, coord2];
          var response = send_confirmation(address, coordinates);
          //state[sender_psid] = -1;
          state[sender_psid] = 4; //STATO DI YES/NO
          // Sends the response message
          callSendAPI(sender_psid, response);
        } catch (e) {
          console.log("ERROR: " + e);
        }
      } else {
        console.error("Unable to receive page:" + err);
      }
    }
  );
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
        var response;
        if (body["resourceSets"][0]["estimatedTotal"] == 0) {
          response = restartRegistra(
            "Mi dispiace ma l'indirizzo non è valido. Riprova: ridigita 'Registra' o premi il pulsante qui sotto"
          );
        } else {
          coordinates =
            body["resourceSets"][0]["resources"][0]["point"]["coordinates"];
          // Create the payload for a basic text message

          response = send_confirmation(req, coordinates);
          //state[sender_psid] = -1;
          // Sends the response message
        }
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
