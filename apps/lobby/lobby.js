var url = require('url');
var express = require('express');
var WebSocketServer = require('ws').Server;
var bodyParser = require('body-parser');
var cors = require('cors');
var whitelist = require('./config/whitelist.json');
var blacklist = require('./config/blacklist.json');

module.exports.Lobby=function(http, config)
{

var app = express();
var rooms = {};
var roomUpdatedAt = {};
var rateLimits = {};
var allowedOrigins = parseAllowedOrigins(config.allowedOrigins);
var logger = config.logger || createNoopLogger();

app.use(cors({origin: makeCorsOriginCheck(allowedOrigins)}));
app.use('/', express.static(__dirname + '/public'));

app.get('/healthz', function(req, res) {
	res.send(JSON.stringify({ok:true}));
});

app.get('/lobby', function(req, res) {
	res.sendFile(__dirname + '/public/lobby.html');
});

app.get('/protocol', function(req, res) {
	var host = config.trustProxy ? (req.headers['x-forwarded-host'] || req.headers.host) : req.headers.host;
	var proto = config.trustProxy ? (req.headers['x-forwarded-proto'] || req.protocol) : req.protocol;
	if( typeof host === 'string' && host.indexOf(',') !== -1)
		host = host.split(',')[0].trim();
	if( typeof proto === 'string' && proto.indexOf(',') !== -1)
		proto = proto.split(',')[0].trim();
	config.protocol.address = proto+'://'+host;
	res.send(JSON.stringify(config.protocol));
});

app.post('/login', bodyParser.json(), function(req, res) {
	cleanupRooms();
	var name = req.body.name;
	var room = req.body.room;
	var hostHeader = req.headers.host || '';
	var host = ( hostHeader.match(/:/g) ) ? hostHeader.slice( 0, hostHeader.indexOf(":") ) : hostHeader;
	var guest = url.parse(req.body.origin).hostname;

	if( !name) {
		res.send(JSON.stringify({
			success: false,
			mess: 'Invalid name.'
		}));
		return;
	}
	if( !room) {
		res.send(JSON.stringify({
			success: false,
			mess: 'Invalid room.'
		}));
		return;
	}
	if( !guest) {
		res.send(JSON.stringify({
			success: false,
			mess: 'Invalid hostname.'
		}));
		return;
	}

	if( config.loginRateLimitMax && !consumeLoginAttempt(req)) {
		logger.warn('login_rate_limited', {ip:req.ip, room:room, player:name});
		res.status(429).send(JSON.stringify({
			success: false,
			mess: 'Login rate limit exceeded.'
		}));
		return;
	}

	if( config.public) {
		if( blacklist[guest]) {
			res.send(JSON.stringify({
				success: false,
				mess: 'Hostname '+guest+' in server blacklist.'
			}));
			return;
		}
	}
	else {
		if( guest===host) {
			//okay
		} else if( !isAllowedGuest(guest)) {
			res.send(JSON.stringify({
				success: false,
				mess: 'Hostname '+guest+' not in server whitelist.'
			}));
			return;
		}
	}

	if( !rooms[room]) {
		rooms[room] = {};
		roomUpdatedAt[room] = {};
		logger.info('room_created', {room:room, message:'Room '+room+' created.'});
	}

	if( config.maxRoomUsers && !rooms[room][name] && Object.keys(rooms[room]).length >= config.maxRoomUsers) {
		res.send(JSON.stringify({
			success: false,
			mess: 'Room '+room+' is full.'
		}));
		return;
	}

	if( !rooms[room][name]) {
		rooms[room][name] = 'loggedin';
		roomUpdatedAt[room][name] = Date.now();
		res.send(JSON.stringify({
			success: true
		}));
	}
	else {
		res.send(JSON.stringify({
			success: false,
			mess: 'Name '+name+' is taken. Please choose another one.'
		}));
	}
});

app.on('mount', function() {
	var wsschat = new WebSocketServer({server:http, path:'/chat'});
	wsschat.on('connection', function(ws) {
		var name, room;
		ws.on('message', function(json) {
			try {
				if( isOversizedMessage(json, config.maxWsMessageSize)) {
					ws.close();
					return;
				}
				var data = JSON.parse(json);
				if( data.mess==='logged in.' && rooms[data.room] && rooms[data.room][data.name]==='loggedin') {
					name = data.name;
					room = data.room;
					rooms[room][name] = ws;
					roomUpdatedAt[room][name] = Date.now();
					logger.info('chat_client_connected', {room:room, player:name, message:'Client '+name+' connected.'});
				}
				if( data.target==='all') {
					for( var I in rooms[room])
						if( rooms[room][I].send)
							rooms[room][I].send(json);
				} else {
					if( rooms[room][data.target].send)
						rooms[room][data.target].send(json);
				}
			} catch (e) {
				logger.error('chat_message_error', {room:room, player:name, error:e, message:name+' caused an error.'});
				ws.close();
			}
		});
		ws.on('close', function() {
			logger.info('chat_client_disconnected', {room:room, player:name, message:'Client '+name+' disconnected'});
			if( rooms[room] && rooms[room][name])
			    delete rooms[room][name];
			if( roomUpdatedAt[room] && roomUpdatedAt[room][name])
			    delete roomUpdatedAt[room][name];
		});
	});
});

setInterval(function()
{
	cleanupRooms();
	for( var room in rooms)
		for( var I in rooms[room])
			if( rooms[room][I].send)
				rooms[room][I].send("{}");
}, 1000*45); //every 45 sec; because heroku timeouts in 55 sec

function parseAllowedOrigins(origins)
{
	var parsed = {};
	if( !origins)
		return parsed;
	origins.split(',').forEach(function(origin) {
		var trimmed = origin.trim();
		if( !trimmed)
			return;
		var hostname = url.parse(trimmed).hostname || trimmed;
		parsed[hostname] = true;
	});
	return parsed;
}

function makeCorsOriginCheck(origins)
{
	return function(origin, callback) {
		if( !origin || Object.keys(origins).length === 0)
			return callback(null, true);
		var hostname = url.parse(origin).hostname;
		callback(null, !!origins[hostname]);
	};
}

function isAllowedGuest(guest)
{
	if( allowedOrigins[guest])
		return true;
	return whitelist[guest];
}

function consumeLoginAttempt(req)
{
	var key = req.ip || req.connection.remoteAddress || 'unknown';
	var now = Date.now();
	var windowMs = config.loginRateLimitWindowMs || 60000;
	pruneExpiredRateLimits(now, windowMs);
	var limit = rateLimits[key];
	if( !limit)
		limit = rateLimits[key] = {startedAt: now, count: 0};
	limit.count++;
	return limit.count <= config.loginRateLimitMax;
}

function pruneExpiredRateLimits(now, windowMs)
{
	for( var key in rateLimits)
		if( now - rateLimits[key].startedAt >= windowMs)
			delete rateLimits[key];
}

function cleanupRooms()
{
	if( !config.roomTtlMs)
		return;
	var now = Date.now();
	for( var room in rooms) {
		for( var name in rooms[room]) {
			var updatedAt = roomUpdatedAt[room] && roomUpdatedAt[room][name];
			if( updatedAt && now - updatedAt > config.roomTtlMs) {
				if( rooms[room][name].close)
					rooms[room][name].close();
				logger.info('room_user_expired', {room:room, player:name});
				delete rooms[room][name];
				delete roomUpdatedAt[room][name];
			}
		}
		if( Object.keys(rooms[room]).length === 0) {
			delete rooms[room];
			delete roomUpdatedAt[room];
		}
	}
}

function isOversizedMessage(message, maxSize)
{
	if( !maxSize)
		return false;
	return Buffer.byteLength(String(message)) > maxSize;
}

function createNoopLogger()
{
	return {
		info: function() {},
		warn: function() {},
		error: function() {}
	};
}

return app;
}

module.exports.PeerServer=function(http, path, config)
{
var peers = {},
	wsspeer = new WebSocketServer({server:http, path:path});

wsspeer.on('connection', function(ws) {
	var name, peer;
	ws.on('message', function(json) {
		if( isOversizedPeerMessage(json, config && config.maxWsMessageSize)) {
			ws.close();
			return;
		}
		var data = JSON.parse(json);
		if( data.open) {
			if( !peers[data.name]) {
				name = data.name;
				peer = {ws:ws};
				peers[name] = peer;
				if( config && config.logger)
					config.logger.info('peer_connected', {player:name, message:'Peer '+name+' connected.'});
			} else {
				ws.close();
			}
		}
		if( peer && data.target) {
			peer.target = data.target;
		}
		if( peer && peer.target && peers[peer.target]) {
			peers[peer.target].ws.send(json);
		}
	});

	ws.on('close', function() {
		if( peer && peer.target && peers[peer.target]) {
			peers[peer.target].ws.close();
		}
		if( config && config.logger)
			config.logger.info('peer_disconnected', {player:name, message:'Peer '+name+' disconnected'});
		peer = {};
		delete peers[name];
	});
});

function isOversizedPeerMessage(message, maxSize)
{
	if( !maxSize)
		return false;
	return Buffer.byteLength(String(message)) > maxSize;
}

return http;
}
