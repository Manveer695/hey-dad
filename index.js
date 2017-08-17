//initialize express
var express = require('express');
//initialize alexa-app
var alexa = require('alexa-app');
//initialize the app and set the port
var app = express();
//verifier to make sure our certs come from Amazon
verifier = require('alexa-verifier');

var r = require('request');

app.set('port', (process.env.PORT || 5000));
app.use(express.static('public'));
app.set('view engine','ejs');

app.use(function(req, res, next) {
	if (!req.headers || !req.headers.signaturecertchainurl) {
		return next();
	}

	req._body = true;
	req.rawBody = '';
	req.on('data', function(data) {
		return req.rawBody += data;
	});
	return req.on('end', function() {
		var cert_url, er, requestBody, signature;
		try {
			req.body = JSON.parse(req.rawBody);
		} catch (_error) {
			er = _error;
			req.body = {};
		}
		cert_url = req.headers.signaturecertchainurl;
		signature = req.headers.signature;
		requestBody = req.rawBody;
		return verifier(cert_url, signature, requestBody, function(er) {
			if (er) {
				console.error('error validating the alexa cert:', er);
				return res.status(401).json({
					status: 'failure',
					reason: er
				});
			} else {
				return next();
			}
		});
	});
});


//what we say when we can't find a matching joke
var jokeFailed = "Sorry, your old dad's memory ain't what it used to be. Try me with another.";

//create and assign our Alexa App instance to an address on express, in this case https://hey-dad.herokuapp.com/api/hey-dad
var alexaApp = new alexa.app('hey-dad');
alexaApp.express(app, "/api/");

//make sure our app is only being launched by the correct application (our Amazon Alexa app)
alexaApp.pre = function(request,response,type) {
	if (request.sessionDetails.application.applicationId != "amzn1.ask.skill.eea0e1a2-78ae-4b49-a204-3fead1de1484") {
		// Fail ungracefully 
		response.fail("Invalid applicationId");
	}
};

//our intent that is launched when "Hey Alexa, open Hey Dad" command is made
//since our app only has the one function (tell a bad joke), we will just do that when it's launched
alexaApp.launch(function(request,response) {
	//log our app launch
	console.log("App launched"); 
	
	//our joke which we share to both the companion app and the Alexa device
	response.card("hi");
	response.say("hi");
	response.send();
	
});

//our TellMeAJoke intent, this handles the majority of our interactions.
alexaApp.intent('callSusiApi',{
		//define our custom variables, in this case, none
        "slots" : {"query":"AMAZON.LITERAL"},
		//define our utterances, basically the whole tell me a joke
        "utterances" : ["{query}"]
    },
    function(request, response){
		//our joke which we share to both the companion app and the Alexa device
		var query = request.slot('query');
		console.log(query);
		var queryUrl = 'http://api.susi.ai/susi/chat.json?q='+query;
		var message = '';
		// Wait until done and reply
		r({
			url: queryUrl,
			json: true
		}, function (error, response1, body) {
			console.log(body);
			if (!error && response1.statusCode === 200) {
				message = body.answers[0].actions[0].expression;
			}
			response.card(message);
			response.say(message);
			response.send();
		});
});

//a shortcut to get our app schema
app.get('/schema', function(request, response) {
    response.send('<pre>'+alexaApp.schema()+'</pre>');
});

//a shortcut to get our app utterances
app.get('/utterances', function(request, response) {
    response.send('<pre>'+alexaApp.utterances()+'</pre>');
});

//make sure we're listening on the assigned port
app.listen(app.get('port'), function() {
    console.log("Node app is running at localhost:" + app.get('port'));
});