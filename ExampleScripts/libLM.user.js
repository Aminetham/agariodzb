// ==UserScript==
// @name         lib Legend Mod
// @namespace    Legend mod agar.io socket
// @version      0.5
// @description  client side handler of communication socket
// @author       You
// @match        https://legendmod.ml/ogario/
// @grant        unsafeWindow
// ==/UserScript==


	
	var my = {
		"name": "lib Legend Mod",
		"log": function(msg){ console.log(this.name + ":"+ msg); }
	};
	window.stat = my;
	Object.assign(window.stat, {
        //'publicIP': "wss://wss.ogario.eu:3443",
        'publicIP': "wss://snez.org:8080/ws",
		"miniMapTeammatesColor": "#01d9cc",
	});
	//var cfg = {}, cfg_org = {
	//};
	my.log("start");
	lib_ogar = my;

	// =====  Test driverー  =====

	if(/legendmod\.ml\/ogario/.test(location.href)){
		//setTimeout(init_html, 100);
		loadScript("https://ajax.googleapis.com/ajax/libs/jquery/1.8.0/jquery.min.js", init_html);
	}
	function init_html(){
		$('body').html(''+
			'<input type="text" id="tag" placeholder="Tag" style="width:5em;" />'+
			'<input type="text" id="nick" placeholder="Nick" style="width:15em;" autofocus="" />'+
			'<input type="text" id="token" placeholder="server token" style="width:10em;" />'+
			'<select name="socket" id="websocket">'+
			'<option value="snez">snez</option>'+
			'<option value="ogario">ogario</option>'+
			'</select>'+
			'<button id="connect" type="submit" onclick="">Connect</button>'+
			'<button id="close" type="submit" onclick="">Close</button>'+
			'<br/><input type="text" id="message" placeholder="chat message" style="width:30em;" />'+
			'<button id="send" type="submit" onclick="">Send</button>'+
			'&nbsp;<button id="users" type="submit" onclick="">Users</button>'+
			'<div id="user_list"></div>'+
			'<br/><textarea id="chat" cols="60" rows="10" ></textarea>'+
			'');
		$('#websocket').click(function(){
			if ($('#websocket').val()=="snez") window.stat.publicIP = "wss://snez.org:8080/ws"
			else if ($('#websocket').val()=="ogario") window.stat.publicIP = "wss://wss.ogario.eu:3443"
		});	
		//window.ogario;		
		$('#connect').click(function(){
			var opt = {
				"tag": $('#tag').val(),
				"nick": $('#nick').val(),
				"serverToken": $('#token').val(),
			};
			opt.ws = 'ws://live-arena-'+ opt.token +'.agar.io:80';
			window.ogario = lib_ogar.create(opt);
			window.ogario.onchat = function(ev){
				var chatElem = $('#chat').get(0);
				var sep = ((chatElem.value == "") ? "" : "\n");
				//chatElem.value += sep + (escapeHtml(ev.nick) +": "+ escapeHtml(ev.message));
				if (ev.message.includes("Welcome! You are connected to the OGARio")){
				ev.message="Welcome to Legend Mod";
				}
				chatElem.value += sep + ev.nick +": "+ ev.message;
			};
		});
		$('#close').click(function(){
			window.ogario.disconnect();
			window.ogario = null;
		});
		$('#send').click(function(){
			var message = $('#message').val();
			if(window.ogario){
				window.ogario.chatSend(message);
			}
		});
        $('#users').click(function(){
			if(! window.ogario){ return; }
			var user_txt = "";
			window.ogario.getPlayerList().forEach(function(player){
				user_txt += '<br/>'+ player.mass +" "+ escapeHtml(player.nick);
			});
			$('#user_list').html(user_txt);
		});
	}

	// =====  External functions  =====
	// Obtain connection parameters from the screen
	my.getOptFromWindow = function(opt_){
		var opt = opt_ || {}, out = opt;
		out.nick = opt.nick || getValue('#nick') || "";
		out.tag = opt.tag || getValue('#clantag', '#tag', '#psk') || "";
		out.serverToken = opt.serverToken
			 || getValue('#server-token', '#server')
			|| getToken() || "";
		out.gameMode = opt.gameMode || getValue('#gamemode') || "";
		out.partyToken = opt.partyToken || getValue('#party-token') || "";
		// * Legend is #nick, #tag, #token, #gamemode
		//	AgarTool is #nick, #psk, #server, #gamemode
		//	"vanilla tool" is #nick, #psk, (#btn-dc-input) #gamemode
		function getValue(...selectors){
			for(;;){
				var selector = selectors.shift();
				if(! selector){
					return null;
				}
				var elem = document.querySelector(selector);
				if(elem){
					return elem.value;
				}
			}
		}
		function getToken(){	// for "vanilla tool"
			var elem = document.querySelector("#btn-dc-input");
			if(! elem){ return null; }
			var found = elem.value.match(/live-arena-([\w\d]+)/);
			if(! found){ return null; }
			return	found[0];
		}
		return out;
	};

	// =====  Legend Mod Class Definition  =====
	function Tan1LibOgar(opt_){
		//this.opt = my.getOptFromWindow(opt_);
		var dummyCallback = function(){};
		Object.assign(this, {
			"onchat": dummyCallback,
		}, my.getOptFromWindow(opt_), {
			"teamPlayers": [],
			"parties": [],
			"customSkinsMap": {},
			'customSkinsCache': {},
			'cacheQueue': [],
		});
	}
	var prot = Tan1LibOgar.prototype;
	my.create = function(opt_){
		var ogar = new Tan1LibOgar(opt_);
		ogar.socket = new WebSocket(window.stat.publicIP);
		ogar.socket.onopen = function() {
			my.log("Socket open");
			var sndBuf = ogar.createView(0x3);
			sndBuf.setUint8(0x0, 0x0);
			sndBuf.setUint16(0x1, 0x191, !0x0);
			ogar.sendBuffer(sndBuf);
			ogar.sendPartyData();
        };
		ogar.socket.onmessage = function(event){
			ogar.handleMessage(event);
		};
		ogar.socket.onclose = function(event) {
			ogar.flushData();
			my.log("Socket close");
		};
		ogar.socket.onerror = function(event) {
			ogar.flushData();
			my.log("Socket error");
        };
		return	ogar;
	};
	prot.disconnect = function(){
		if(this.socket){
			this.socket.close();
			delete this.socket;
		}
	};
	prot.getPlayerList = function(){
		var timeLate = Date.now() - 0x7d0;
		return	this.teamPlayers
			.filter(function(x){
				return x.alive && x.updateTime > timeLate && x.mass > 0;
			}).sort(function(x, y){return y.mass - x.mass;});
	};

	// =====  Legend Mod Receive Handler  =====
	prot.handleMessage = function(event){
		var ogar = this;
		//my.log("handleMessage");
		//console.dir(event);
		//my.log("event.data type="+ typeof event.data.constructor.name);
		//   With the Legend Mod code
		//          own.readMessage(new DataView(event.data));
		// But, in fact it will return with a Blob
		if(ArrayBuffer.prototype.isPrototypeOf(event.data)){
			return ogar.readMessage(new DataView(event.data));
		}// I regard it as Blob
		var fr = new FileReader();
		fr.onload = function(){
			return ogar.readMessage(new DataView(fr.result));
		};
		fr.onerror = function(){
			my.log("message convert error");
		};
		fr.readAsArrayBuffer(event.data);
	};
	prot.readMessage = function(rcvBuf){
        var msgcode = rcvBuf.getUint8(0x0);
        //console.log(scr_name + ": message code=0x"+ msgcode.toString(16));
		switch (msgcode) {
		  case 0x0:
			this.playerID = rcvBuf.getUint32(0x1, !0x0);
			my.log("got playerID="+ this.playerID);
			break;
		  case 0x1:
			my.log("request sendPlayerUpdate");
			this.sendPlayerUpdate();
			break;
		  case 0x14:
			this.updateTeamPlayer(rcvBuf);
			break;
		  case 0x1e:
			this.updateTeamPlayerPosition(rcvBuf);
			break;
		  case 0x60:
			this.updateParties(rcvBuf);
			this.displayParties();
			break;
		  case 0x64:
			my.log("readChatMessage");
			this.readChatMessage(rcvBuf);
			break;
          default:
			my.log("unknown message code=0x"+ msgcode.toString(16));
			break;
		}
	};

	// =====  Legend Mod reception processing  =====
	prot.updateTeamPlayer = function(rcvBuf){
		var teamPlayerID = rcvBuf.getUint32(1, true);
		var bufPos = 0x5;
		function strFromBuf(){	// Get a character string up to the null end
			var value = "";
			for(;;){
				const code = rcvBuf.getUint16(bufPos, true);
				if (0 == code) break;
				value += String.fromCharCode(code);
				bufPos += 0x2;
			}
			bufPos += 0x2;
			return value;
		}
		var teamPlayerNick = strFromBuf();
		var skinURL = this.checkSkinURL(strFromBuf());
		var setColor = strFromBuf();
		var playerColor = strFromBuf();
		var skinID = ":party" === this.gameMode
			? teamPlayerNick + playerColor : teamPlayerNick;
		var teamPlayerIdx = this.checkPlayerID(teamPlayerID);
		if(null !== teamPlayerIdx){
			this.teamPlayers[teamPlayerIdx].nick = teamPlayerNick;
			this.teamPlayers[teamPlayerIdx].skinID = skinID;
			this.teamPlayers[teamPlayerIdx].skinURL = skinURL;
			this.teamPlayers[teamPlayerIdx].setColor(setColor);
		}else{
			var teamPlayerObj = new function
					(teamPlayerID, teamPlayerNick, skinID, skinURL){
				this.id = teamPlayerID;
				this.nick = teamPlayerNick;
				this.skinID = skinID;
				this.skinURL = skinURL;
				this.x = 0x0;
				this.y = 0x0;
				this.lastX = 0x0;
				this.lastY = 0x0;
				this.mass = 0x0;
				this.clanTag = '';
				this.color = window.stat.miniMapTeammatesColor;
				this.alive = false;
				this.updateTime = null;
				this.pi2 = 0x2 * Math.PI;
				this.setColor = function(setColor) {
					if(0x7 == setColor.length){
						this.color = setColor;
					}
				};
			}(teamPlayerID, teamPlayerNick, skinID, skinURL);
			teamPlayerObj.setColor(setColor);
			this.teamPlayers.push(teamPlayerObj);
		}
		this.cacheCustomSkin(teamPlayerNick, playerColor, skinURL);
	};
	prot.updateTeamPlayerPosition = function(rcvBuf){
		const teamPlayerID = rcvBuf.getUint32(0x1, !0x0);
		const teamPlayerIdx = this.checkPlayerID(teamPlayerID);
        if(null === teamPlayerIdx){
			return;
		}
		const teamPlayerX = rcvBuf.getInt32(0x5, !0x0);
		const teamPlayerY = rcvBuf.getInt32(0x9, !0x0);
		const teamPlayerMass = rcvBuf.getUint32(0xd, !0x0);
		if(teamPlayerMass > 0x57e40){	// 0x57e40 = 360000
			return;
		}
		var teamPlayerObj = this.teamPlayers[teamPlayerIdx];
		teamPlayerObj.x = teamPlayerX;
		teamPlayerObj.y = teamPlayerY;
		teamPlayerObj.mass = teamPlayerMass;
		teamPlayerObj.alive = !0x0;
		teamPlayerObj.updateTime = Date.now();
		//this.targeting && this.targetID && teamPlayerID == this.targetID && this.updateTarget(teamPlayerObj.nick, teamPlayerObj.skinURL, teamPlayerX, teamPlayerY, teamPlayerMass);
	};
	//prot.updateTarget = function(nick, skinURL, teamPlayerX, teamPlayerY, teamPlayerMass){
	//	// dummy
	//};
	prot.checkPlayerID = function(teamPlayerID){
		if(teamPlayerID){
			for(var idx = 0x0; idx < this.teamPlayers.length; idx++){
				if(this.teamPlayers[idx].id == teamPlayerID){
					return idx;
				}
			}
		}
		return null;
	};
	prot.updateParties = function(rcvBuf){
		this.parties = [];
		for(var partyNum = rcvBuf.getUint8(0x1), bufIdx = 0x2, strIdx = 0x0;
				strIdx < partyNum; strIdx++){
			var partyName = '';
			for(;;){
				var charCode = rcvBuf.getUint16(bufIdx, !0x0);
				if(0x0 == charCode){
					break;
				}
				partyName += String.fromCharCode(charCode);
				bufIdx += 0x2;
			}
			bufIdx += 0x2;
			this.parties.push(partyName);
		}
	};
	prot.displayParties = function(){
		// dummy
	};
	prot.readChatMessage = function(rcvBuf){
		var mcode = rcvBuf.getUint8(0x1);
		var senderID = rcvBuf.getUint32(0x2, !0x0);
		var reciverID = rcvBuf.getUint32(0x6, !0x0);
		var msg = "";
		for(var idx = 0xa; idx < rcvBuf.byteLength; idx += 2){
			var charCode = rcvBuf.getUint16(idx, !0x0);
			if(0 === charCode){
				break;
			}
			msg += String.fromCharCode(charCode);
		}
		//var senderIdx = this.checkPlayerID(senderID);
		//var nick = ((null === senderIdx) ? "no name"
		//	: this.teamPlayers[senderIdx].nick);
		//own.displayChatMessage(date, mcode, senderID, msg);
		var nick = "no name";
		var msgOrg = msg;
		var msgRe = /([\s\S]*?): ([\s\S]*)/.exec(msg);
		if(msgRe){
			nick = msgRe[1];
			msg = msgRe[2];
		}
		my.log("readChatMessage msg="+ msgOrg);
		//if(this.onchat){
			this.onchat({
				"nick": nick,
				"message": msg,
				"mcode": mcode,
				"senderID": senderID,
				"reciverID": reciverID,
				"isCommand": (mcode == 0x66),
				"messageOriginal": msgOrg,
			});
		//}
	};

	// =====  Legend transmission processing  =====
	prot.sendPartyData = function(opt_){
		var fake = Object.assign({
			"tag": "",
			"partyToken": "",
			"serverToken": "",
			"nick": "",
			"skinURL": "",
		}, this, opt_ || {});
		//prot.sendPlayerClanTag();
		//prot.sendPartyToken();
		//prot.sendServerToken();
		//prot.sendPlayerNick();
		//prot.sendPlayerSkinURL();
		this.sendPlayerData(0xb,  "lastSentClanTag", fake.tag);
		this.sendPlayerData(0xf,  "lastSentPartyToken", fake.partyToken);
		this.sendPlayerData(0x10, "lastSentServerToken", fake.serverToken);
		this.sendPlayerData(0xa,  "lastSentNick", fake.nick);
		this.sendPlayerData(0xc,  "lastSentSkinURL", fake.skinURL);
	};
	prot.sendPlayerData = function(code, last, value){
		this.sendBuffer(this.strToBuff(code, value));
		this[last] = value;
	};
	prot.sendPlayerUpdate = function(opt_){
		var fake = Object.assign({
			"nick": "",
			"skinURL": "",
			"color": "#01d9cc",
			"playerColor": "#01d9cc",
		}, this, opt_ || {});
		const bufsize = 0x29 + 2 * fake.nick.length + 2 * fake.skinURL.length;
		var sndBuf = this.createView(bufsize);
		sndBuf.setUint8(0x0, 0x14);
		sndBuf.setUint32(0x1, fake.playerID, !0x0);
		var bufidx = 0x5;
		addString(fake.nick);
		addString(fake.skinURL);
		addString(fake.color);
		addString(fake.playerColor);
		this.sendBuffer(sndBuf);
		function addString(value){
			for(var idx = 0; idx < value.length; idx ++){
				sndBuf.setUint16(bufidx, value.charCodeAt(idx), !0x0);
				bufidx += 2;
			}
			sndBuf.setUint16(bufidx, 0x0, !0x0);
			bufidx += 2;
		}
		my.log("sendPlayerUpdate"+
			" nick='"+ fake.nick +"'"+
			" skinURL='"+ fake.skinURL +"'"+
			" color='"+ fake.color +"'"+
			" playerColor='"+ fake.playerColor +"'");
	};
	prot.sendPlayerPosition = function(playerX, playerY, playerMass){
		var sndBuf = this.createView(0x11);
		sndBuf.setUint8(0x0, 0x1e);
		sndBuf.setUint32(0x1, this.playerID, !0x0);
		sndBuf.setInt32(0x5, playerX, !0x0);
		sndBuf.setInt32(0x9, playerY, !0x0);
		sndBuf.setUint32(0xd, playerMass, !0x0);
		this.sendBuffer(sndBuf);
	};

	// Send chat
	// [Caution] If playerID and nick do not correspond, it will be played on the receiving side
	prot.chatSend = function(message, opt_){
		var fake = Object.assign({
			"mcode": 0x65,		// 0x65: General, 0x66: Command
			"reciverID": 0,
		}, this, opt_ || {});
		var msg = fake.nick +': '+ message;
		var buf = this.createView(0xa + 2 * msg.length);
		buf.setUint8(0x0, 0x64);
		buf.setUint8(0x1, fake.mcode);
		buf.setUint32(0x2, fake.playerID, !0x0);
		buf.setUint32(0x6, fake.reciverID, !0x0);
		for(var idx = 0; idx < msg.length; idx ++){
			buf.setUint16(0xa + 2 * idx, msg.charCodeAt(idx), !0x0);
		}// There is no character string termination
		this.sendBuffer(buf);
	};

	// =====  Legend Mod auxiliary processing  =====
	// Returns the argument if it is valid as the URL of the custom skin, otherwise returns the empty string
	prot.checkSkinURL = function(skinURL) {
		return /^https?:\/\/i\.(?:imgur|hizliresim)\.com\/\w{6,8}\.(?:jpg|jpeg|png)\??\d*$/i.test(skinURL) ? skinURL : '';
	};

	// Cache custom skins
	prot.cacheCustomSkin = function(nick, playerColor, skinURL){
		if(! skinURL){
			return;
		}
		var skinID = ":party" === this.gameMode ? nick + playerColor : nick;
		this.customSkinsMap[skinID] = skinURL;
		if(! this.customSkinsCache.hasOwnProperty(skinURL)){
			this.loadSkin(this.customSkinsCache, skinURL);
		}
	};
	prot.getCustomSkin = function(nick, playerColor) {
		var skinID = ":party" === this.gameMode ? nick + playerColor : nick;
		return this.customSkinsMap.hasOwnProperty(skinID)
			? this.getCachedSkin(this.customSkinsCache, this.customSkinsMap[skinID]) : null;
	};
	prot.loadSkin = function(skinsCache, skinURL) {
        var ogar = this;
        skinsCache[skinURL] = new Image();
		skinsCache[skinURL].crossOrigin = "Anonymous";
		skinsCache[skinURL].onload = function(){
			if(this.complete && this.width && this.height && this.width <= 0x7d0 && this.height <= 0x7d0){
				ogar.cacheQueue.push(skinURL);
				if(0x1 == ogar.cacheQueue.length){
					ogar.cacheSkin(ogar.customSkinsCache);
				}
			}
		};
		skinsCache[skinURL].src = skinURL;
	};
	prot.cacheSkin = function(skinsCache){
		if(0x0 === this.cacheQueue.length){
			return;
		}
		var skinURL = this.cacheQueue.shift();
        if(! skinURL){
			return;
		}
		var canvas = document.createElement("canvas");
		canvas.width = 0x200;
		canvas.height = 0x200;
		var skinCxt = canvas.getContext('2d');
		skinCxt.beginPath();
		skinCxt.arc(0x100, 0x100, 0x100, 0x0, 0x2 * Math.PI, !0x1);
		skinCxt.clip();
		skinCxt.drawImage(this.customSkinsCache[skinURL], 0x0, 0x0, 0x200, 0x200);
		this.customSkinsCache[skinURL + "_cached"] = new Image();
		this.customSkinsCache[skinURL + "_cached"].src = canvas.toDataURL();
		canvas = null;
		this.cacheSkin(this.customSkinsCache);
	};
	prot.getCachedSkin = function(skinsCache, skinURL) {
		var skinImg = skinsCache[skinURL + "_cached"];
		return skinImg && skinImg.complete && skinImg.width ? skinImg : null;
	};

	// =====  General-purpose communication processing  =====
	prot.flushData = function(){
	};
	prot.strToBuff = function (code, value){
		var sndBuf = prot.createView(1 + 2 * value.length);
        sndBuf.setUint8(0, code);
        for (var idx = 0; idx < value.length; idx ++){
            sndBuf.setUint16(1 + 2 * idx, value.charCodeAt(idx), !0x0);
        }// I do not want to output the terminating NULL character
        return sndBuf;
	};
	prot.sendBuffer = function(buf){
		if(! this.isConnected()){
			my.log("socket is not open");
			return false;
		}
		this.socket.send(buf.buffer);
	};
	prot.createView = function(bufsize){
		return new DataView(new ArrayBuffer(bufsize));
	};
	prot.isConnected = function(){
		return this.socket && this.socket.readyState == WebSocket.OPEN;
	};
	// =====  Other general-purpose processing  =====
	function loadScript(url, callback){
		var script = document.createElement("script");
		script.type = "text/javascript";
		script.src = url;
		if(typeof callback !== 'undefined'){
			script.onload = callback;
		}
		document.head.appendChild(script);
	}
	function escapeHtml(e) {
		return e.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#039;");
	}
