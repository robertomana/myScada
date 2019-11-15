"use strict";

// ref: https://github.com/node-opcua/node-opcua

// https://github.com/node-opcua/node-opcua/wiki/2.0.0-breaking-changes

const express = require('express');
const app = express();
const opcua = require("node-opcua");
const async = require("async");

const http = require('http');
const server = http.Server(app); 
const io = require('socket.io')(server)


/**********************************/

var scada=[];     // 160 bit
var scadaInt=[];  //   8 int

/* L'applicazione legge dal PLC un vettore denominato "scada" lungo 160 bit e 
   restituisce al client il json indicato di seguito :

  {
	 "ingressi":     array 32 bit  -  scada[  0- 31]
	 "uscite":       array 32 bit  -  scada[ 32- 63]
	 "tappeGemma":   array 16 bit  -  scada[ 64- 79]
	 "tappeM1":      array 32 bit  -  scada[ 80-111]
	 "tappeM2":      array 16 bit  -  scada[112-127]
	 "stati":        array 16 bit  -  scada[128-143]
	 "parametriBit": array 16 bit  -  scada[144-159]
	 "parametriInt": array  8 int  -  letto da scadaInt
  }	
 
*/ 


 /* *********************************************************************** */
 //                              OPC UA CLIENT
 /* *********************************************************************** */
var the_session, the_subscription;

const endpointUrl="opc.tcp://localhost:4840"; 
 
const opcClient = opcua.OPCUAClient.create();


async.series([
    // step 1 : connect to Server
    function(callback)  {
		opcClient.connect(endpointUrl,function (err) {
            if(err) 
                console.log(" cannot connect to endpoint :" , endpointUrl );
			else 
                console.log("Connection to OPC Server OK !");
            callback(err);
        });
    },

    // step 2 : createSession
    function(callback) {
        opcClient.createSession( function(err,session) {
		    if(err) 
                console.log(" cannot create new session" );
            else {
                the_session = session;
				console.log("Session OK !");
            }			
            callback(err);
        });
    },

	
    // step 3 : Creazione di una subscription e dei relativi MonitoredItem
    function(callback) {  
        // a) Creazione della Subscription  
		the_subscription = opcua.ClientSubscription.create(the_session,{
            requestedPublishingInterval: 120,  // 1000
            requestedMaxKeepAliveCount: 20,    // 2
            requestedLifetimeCount: 100,       // 10
 
            publishingEnabled: true,
            priority: 10,
            maxNotificationsPerPublish: 10    
        });
       
	    // b) Gestione degli eventi relativi alla subscription
        the_subscription.on("started",function(){
            // console.log("Continuous Read Started - subscriptionId=",the_subscription.subscriptionId);
            console.log("Server in attesa di richieste sulla porta 1337 ......");         
        }).on("keepalive",function(){
            // console.log("keepalive");
        }).on("terminated",function(){
		    // se non si richiama terminate(), a questa riga non si arriva mai
            callback(null);
        });     
	   
	   	// c) Eventuale impostazione esplicita della terminazione 
        setTimeout(function(){
            // the_subscription.terminate();
        },30000);   
	   
	   
        // *****************************************************************	   
	    // step 4: Lettura dei valori
		
        var serverParameters = {
		    samplingInterval: 100,  
            queueSize: 4,
            discardOldest: true
		};
						
		var monitorScada  = opcua.ClientMonitoredItem.create(the_subscription,
	        {
			   nodeId: opcua.resolveNodeId('ns=3;s="DB_scada"."scada"'),
			   attributeId: opcua.AttributeIds.Value
            },
            serverParameters, 
			opcua.TimestampsToReturn.Both    // in caso di problemi commentare
        ); 		
						
	    var monitorScadaInt  = opcua.ClientMonitoredItem.create(the_subscription,
	        {
			   nodeId: opcua.resolveNodeId('ns=3;s="DB_scadaInt"."scadaInt"'),
			   attributeId: opcua.AttributeIds.Value
            },
            serverParameters, 
			opcua.TimestampsToReturn.Both    // in caso di problemi commentare
        );
	    
        monitorScada.on("changed",function(dataValue){
	        scada = dataValue.value.value;
			invia();
        });
        monitorScadaInt.on("changed",function(dataValue){
	        scadaInt = dataValue.value.value;
			invia();
        });			
    },	


	// step 5 : Eventuale Chiusura della Sessione (a seguito di terminate esplicito)
    function(callback) {
	    // dopo la chiusura della subscription si chiude la sessione
        the_session.close(function(err){
            if(err)
                console.log("session closing failed");
			else
			    console.log("session closing ok");
            callback(err);
        });
    }
  ],
  
  // callback finale
  function(err) {
     if (err)  
        console.log("ERRORE interfacciamento con OPC-UA: " + err);
	 else 
        console.log("OPC-UA connection closed");
     opcClient.disconnect(function(){});
  }, 
  
  // Setting 3rd parameter to true will ensure there's at least a tick between each task to prevent RangeErrors.
  true
);		             



 /* *********************************************************************** */
 //                                 HTTP SERVER
 /* *********************************************************************** */
server.listen(1337);
app.use(express.static('static'));

// Il servizio "scrivi" si aspetta come parametro il seguente JSON :
// {"comando":nomeComando, "value":true/false}
app.get('/scrivi', function (req, res) {
    let comando = req["query"]["comando"];
    let valore = req["query"]["value"];
	if (valore =="true")
		valore=true
	else
		valore=false;
	let param = {
		"value": valore, 
		"dataType": "Boolean"
	}
	let id = 'ns=3;s="DB_comandi"."'+comando +'"';
	console.log("esecuzione comando: "+id);
	
	the_session.writeSingleNode(id, param, function(err, statusCode, diagnosticInfo) {
        if (!err) {
 	        res.send({"write":"OK"});
        }
		else {
		    console.log("Errore :" + err );
 			res.send({"write":"NOK"});
		}
    });    
});


var the_socket;
 // connessione di un web Client
io.on('connection', function (socket) {		
	console.log(' User ' + socket.id + ' connected!');
	the_socket = socket; 
	// in corrispondenza della connessione del client gli invio subito i dati aggiornati.
	invia();
	socket.on('disconnect', function () {
		console.log(' User ' + this.id + ' disconnected!');
	});
});

var n=0;
function invia() {	      
	var i,j=0;
	var ingressi=[];
	var uscite=[];
	var tappeGemma=[];
	var tappeM1=[];
	var tappeM2=[];
	var stati=[];
	var parametriBit=[];
	for(i=0; i<32; i++) 
		ingressi[j++]=scada[i];
	j=0;
	for(i=32; i<64; i++) 
		uscite[j++]=scada[i];
	j=0;
	for(i=64; i<80; i++) 
		tappeGemma[j++]=scada[i];
	j=0;
	for(i=80; i<112; i++) 
		tappeM1[j++]=scada[i];
	j=0;
	for(i=112; i<128; i++) 
		tappeM2[j++]=scada[i];
	j=0;
	for(i=128; i<144; i++) 
		stati[j++]=scada[i];
	j=0;
	for(i=144; i<160; i++) 
		parametriBit[j++]=scada[i];
				
	var json = {
		"ingressi":ingressi,
		"uscite":uscite,
		"tappeGemma": tappeGemma,
		"tappeM1": tappeM1,
		"tappeM2": tappeM2,
		"stati":stati,
		"parametriBit":parametriBit,
		"parametriInt":scadaInt
	}	
	if(the_socket!=undefined) {
		n++;
		console.log("invio dati al client: " + n);
		the_socket.emit('notify_message', JSON.stringify(json));
	}
}

