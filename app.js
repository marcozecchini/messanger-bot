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
var contact_msg = "Ciao! 👋 Grazie di averci contattato. Provvederemo a risponderti al più presto! 😃\nIntanto consulta le `Domande frequenti` sul nostro sito oppure clicca `Registra` per registrare gratuitamente la tua attività.";
var reg_msg = "Ciao! 📝 Ti puoi registrare GRATUITAMENTE da questa chat. Clicca sul tasto qui di seguito e compila i campi richiesti.";
var reg_msg2 = "Ti puoi registrare GRATUITAMENTE da questa chat. 📝 Clicca sul tasto qui di seguito e compila i campi richiesti.";

/****************** Handles messages events ******************/
async function handleMessage(sender_psid, received_message) {
  let response;

  if (received_message.text) {
    switch (received_message.text.replace(/[^\w\s]/gi, '').trim().toLowerCase()) {
      
      case "registra":
        requests[sender_psid] = {};                         // Create the payload for registration procedure
        response = setDatiAttivita(reg_msg2);
        state[sender_psid] = 0;                             // STATO DI REGISTRA
        console.log(state);
        break;
      
      default:
        console.log(state);
        if (state[sender_psid] !== -1) {
          response = contactMessage(contact_msg);           // Create the payload for a basic text message
          state[sender_psid] = -1;                          // STATO DI INIZIO
        }
        break;
    }
  } 
  else if (received_message.attachments) {
    console.log(state);
    if (state[sender_psid] !== -1) {
      response = contactMessage(contact_msg);               // Create the payload for no text message
      state[sender_psid] = -1;                              // STATO DI INIZIO
    }
  }
  callSendAPI(sender_psid, response);                       // Sends the response message
}
/*************************************************************/


/**************** Handles messaging_postbacks ****************/
function handlePostback(sender_psid, received_postback) {
  let response;
  let payload = received_postback.payload;                                // Get the payload for the postback
  
  if (payload === "Registra" && state[sender_psid] !== 0) {
    requests[sender_psid] = {};                                           // Create the payload for Registra text message
    response = setDatiAttivita(reg_msg2);
    state[sender_psid] = 0;                                               // STATO DI REGISTRA
    console.log(state);   
  } 
  else if (payload === "Registra2" && state[sender_psid] !== 0) {
    requests[sender_psid] = {};                                           // Create the payload for "Come posso registrarmi" button
    response = setDatiAttivita(reg_msg);
    state[sender_psid] = 0;                                               // STATO DI REGISTRA
    console.log(state);  
  } 
  else {
    console.log(state);
    if (state[sender_psid] !== -1) {
      response = contactMessage(contact_msg);
      state[sender_psid] = -1;                                            // STATO DI INIZIO
    }
  }
  callSendAPI(sender_psid, response);                                     // Send the message to acknowledge the postback
}
/*************************************************************/



/*** Define the template to insert the main data of the shop ***/
function setDatiAttivita(text) {
  let response = {
    attachment: {
      type: "template",
      payload: {
        template_type: "button",
        text: text,
        buttons: [
          {
            type: "web_url",
            url: "https://colligo.shop/registrati",
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
/*************************************************************/

/*** Define template to restart the procedure or see the faq ***/
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
/*************************************************************/


/*** Serve the colligo registration path for the webview ***/
app.get("https://colligo.shop/registrati", (req, res, next) => {
  console.log("SENDING activity form");
  let referer = req.get("Referer");
  if (referer) {
    if (referer.indexOf("www.messenger.com") >= 0) {
      res.setHeader("X-Frame-Options", "ALLOW-FROM https://www.messenger.com/");
    } else if (referer.indexOf("www.facebook.com") >= 0) {
      res.setHeader("X-Frame-Options", "ALLOW-FROM https://www.facebook.com/");
    }
    console.log(req.uri.href);
    console.log(res.request.uri.href);
  }
});
/*************************************************************/

/********* Sends response messages via the Send API *********/
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
/*************************************************************/

/****** Accepts POST requests at /webhook endpoint ******/
app.post("/webhook", (req, res) => {
  let body = req.body;                                    // Parse the request body from the POST

  if (body.object === "page") {                           // Check the webhook event is from a Page subscription
    body.entry.forEach(function(entry) {                  // Iterate over each entry - there may be multiple if batched
      
      // Get the webhook event. entry.messaging is an array, but
      // will only ever contain one event, so we get index 0
      let webhook_event = entry.messaging[0]
      console.log(webhook_event);

      let sender_psid = webhook_event.sender.id;          // Get the sender PSID
      console.log("Sender PSID: " + sender_psid);

      // Check if the event is a message or postback and
      // pass the event to the appropriate handler function
      if (webhook_event.message) {
        handleMessage(sender_psid, webhook_event.message);
      } else if (webhook_event.postback) {
        handlePostback(sender_psid, webhook_event.postback);
      }
    });

    res.status(200).send("EVENT_RECEIVED");               // Return a '200 OK' response to all events
  } else {
    res.sendStatus(404);                                  // Return a '404 Not Found' if event is not from a page subscription
  }
});
/*************************************************************/



/****** Accepts GET requests at the /webhook endpoint ******/
app.get("/webhook", (req, res) => {
  /** UPDATE YOUR VERIFY TOKEN **/
  const VERIFY_TOKEN = "qHAYG9u3eSON";

  let mode = req.query["hub.mode"];                        // Parse params from the webhook verification request
  let token = req.query["hub.verify_token"];
  let challenge = req.query["hub.challenge"];

  if (mode && token) {                                     // Check if a token and mode were sent
    if (mode === "subscribe" && token === VERIFY_TOKEN) {  // Check the mode and token sent are correct
      console.log("WEBHOOK_VERIFIED");                     // Respond with 200 OK and challenge token from the request
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);                                 // Responds with '403 Forbidden' if verify tokens do not match
    }
  }
});
/*************************************************************/
