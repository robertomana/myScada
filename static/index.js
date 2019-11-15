"use strict";

const DOWN = "mousedown"  // "touchstart" 
const UP = "mouseup";     // "touchend" 
const GRIGIO = "#AAA";
const VERDE = "#0F0";

var scada;      // Base dati condivisa tra background e foreground
var scadaCopia; // copia dei dati per l'intercettazione dei fronti

var comandi = [
	"bStop",
	"bAuto",
	"bMan",
	"bReset",
	"bEmergenza",
	"bAccendiLed",  // free_1
	"free_2",
	"free_3",
	"free_4",
	"free_5",
	"free_6",
	"free_7",
	"free_8",
	"free_9",
	"free_10",
	"free_11",
	"free_12",
	"free_13",
	"free_14",
	"free_15",
	"free_16",
	"free_17",
	"free_18",
	"free_19",
	"free_20",
	"free_21",
	"free_22",
	"free_23",
	"free_24",
	"free_25",
	"free_26",
	"free_27",
];

function inviaRichiesta(url, method, parameters){
	$.ajax({
		url : url,
		// url: "http://192.168.137.1:1337" + url,  
		type: method,
		dataType: "json",
		contentType: "application/x-www-form-urlencoded; charset=UTF-8",
		data: parameters,
		timeout : 6000,
		success: null,
		error : function(jqXHR, test_status, str_error){
			if(jqXHR.status==0)
				alert("server timeout");
			else
				alert("Server Error: "+jqXHR.status+ " - " +jqXHR.responseText);	
		}
	});
}
	
	
	
$(document).ready(function () {	
	
	// 1 ************************** Richiesta di connessione al server ******************************
	
 	var socket = io.connect();
	// var socket = io.connect("http://192.168.137.1:1337");
	console.log("socket: " + socket);
	socket.on('connect', function(){				
		console.log("connessione ok");
	});		
	socket.on('disconnect', function(){
		alert("Sei stato disconnesso!");
	});


	
	// 2 ************************************* Background ******************************************
	var first=null;
	// Evento generato in corrispondenza di ogni ricevimentoDati dal server (in seguito a variazione su PLC)
	socket.on('notify_message', function(data){
		scada = JSON.parse(data); 
		// aggiornaPagina verrà richiamata ad intervalli regolari di 100ms, in modo asincrono rispetto alla lettura dei dati da PLC
        if(first==null)	{	
			first=setInterval(aggiornaPagina, 100);
			scadaCopia=scada;	// senza questo, il primo giro scadaCopia sarebbe vuoto
		}
	});				
	
	
	
	// 3 ************************************** Foreground ***************************************** 
	function aggiornaPagina(){
		/* var scada = {
			"ingressi":ingressi,
			"uscite":uscite,
			"tappeGemma": tappeGemma,
			"tappeM1": tappeM1,
			"tappeM2": tappeM2,
			"stati":stati,
			"parametriBit":parametriBit,
			"parametriInt":parametriInt }
		*/
		var sAuto = scada["stati"][0];
		var sStop = scada["stati"][1];
		var sMan = scada["stati"][2];
		var sAttesaStop = scada["stati"][4];
		var cntCicli = scada["parametriInt"][0];
		
		var colore;
		colore = sStop ? VERDE : GRIGIO;
		$("#sStop").css("background-color", colore);
		colore = sAuto ? VERDE : GRIGIO;
		$("#sAuto").css("background-color", colore);
		colore = sAttesaStop ? VERDE : GRIGIO;
		$("#sAttesaStop").css("background-color", colore);
		colore = sMan ? VERDE : GRIGIO;
		$("#sMan").css("background-color", colore);	

		// led relativi alle uscite del plc
		colore = scada["uscite"][28] ? VERDE : GRIGIO;
		$("#led28").css("background-color", colore);
		colore = scada["uscite"][29] ? VERDE : GRIGIO;
		$("#led29").css("background-color", colore);			
		colore = scada["uscite"][30] ? VERDE : GRIGIO;
		$("#led30").css("background-color", colore);
		colore = scada["uscite"][31] ? VERDE : GRIGIO;
		$("#led31").css("background-color", colore);	
		
		// fronte di accensione e spegnimento di un led
		if(scada["uscite"][31] && !(scadaCopia["uscite"][31])) {
		      console.log("L'ultimo led si è appena acceso");
		}
		if( !(scada["uscite"][31]) && scadaCopia["uscite"][31] ) {
		      console.log("L'ultimo led si è appena spento");
		}		

        $(".cntCicli").text(cntCicli);		
		scadaCopia=scada;		
	}


	
	// 4 ************************************** Invio Comandi al PLC **************************************** 
	// stop
	$("#btnStop").on(DOWN, function(){
		inviaRichiesta("/scrivi", "get", {"comando":comandi[0], "value":true} );
	});
	$("#btnStop").on(UP, function(){
		inviaRichiesta("/scrivi", "get", {"comando":comandi[0], "value":false} );
	});
	
	// automatico
	$("#btnAuto").on(DOWN, function(){
		inviaRichiesta("/scrivi", "get", {"comando":comandi[1], "value":true} );
	});
	$("#btnAuto").on(UP, function(){
		inviaRichiesta("/scrivi", "get", {"comando":comandi[1], "value":false} );
	});

	// manuale
	$("#btnMan").on(DOWN, function(){
		inviaRichiesta("/scrivi", "get", {"comando":comandi[2], "value":true} );
	});
	$("#btnMan").on(UP, function(){
		inviaRichiesta("/scrivi", "get", {"comando":comandi[2], "value":false} );
	});

	// reset
	$("#btnReset").on(DOWN, function(){
		inviaRichiesta("/scrivi", "get", {"comando":comandi[3], "value":true} );
	});
	$("#btnReset").on(UP, function(){
		inviaRichiesta("/scrivi", "get", {"comando":comandi[3], "value":false} );
	});
		
	// test Led
	$("#btnTest").on(DOWN, function(){
		inviaRichiesta("/scrivi", "get", {"comando":comandi[5], "value":true} );
	});
	$("#btnTest").on(UP, function(){
		inviaRichiesta("/scrivi", "get", {"comando":comandi[5], "value":false} );
	});
	
});