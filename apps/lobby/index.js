var express = require('express');
var app = express();
var Lobby = require('./lobby').Lobby;
var http = require('http').createServer(app);
var opts = require('optimist')
	.usage('Usage: $0')
	.options({
		peerjs: {
			demand: false,
			description: 'Use peerjs transport',
			default: false
		},
		public: {
			demand: false,
			description: 'Start a public lobby (dangerous!)',
			default: false
		},
		port: {
			demand: false,
			default: null
		}
	})
	.argv;

var port = Number(opts.port || process.env.PORT || 8001);
var trustProxy = String(process.env.TRUST_PROXY || '').toLowerCase() === 'true';

if( trustProxy)
	app.enable('trust proxy');

var lobby_config = {
	public: opts.public || String(process.env.PUBLIC_LOBBY || '').toLowerCase() === 'true',
	protocol: null,
	trustProxy: trustProxy,
	allowedOrigins: process.env.ALLOWED_ORIGINS || '',
	roomTtlMs: Number(process.env.ROOM_TTL_MS || 0),
	maxRoomUsers: Number(process.env.MAX_ROOM_USERS || 0),
	loginRateLimitMax: Number(process.env.LOGIN_RATE_LIMIT_MAX || 0),
	loginRateLimitWindowMs: Number(process.env.LOGIN_RATE_LIMIT_WINDOW_MS || 60000),
	maxWsMessageSize: Number(process.env.MAX_WS_MESSAGE_SIZE || 0)
};

if( opts.public)
	console.log('public server');
else
	console.log('private server');

if( opts.peerjs)
{
	var PeerServer = require('peer').ExpressPeerServer;
	var path = '/peerjs';
	lobby_config.protocol = {
		name:'F.Lobby (PeerJS)',
		library:'/peerjs/network.js',
		port:port,
		path:path
	};
	app.use(path, PeerServer(http, {debug:true}));
	console.log('PeerJS transport');
}
else
{
	var PeerServer = require('./lobby').PeerServer;
	var path = '/peer';
	lobby_config.protocol = {
		name:'F.Lobby (WebSocket)',
		library:'/ws/network.js',
		port:port,
		path:path
	};
	PeerServer(http, path, lobby_config);
	console.log('WebSocket transport');
}

app.use('/', Lobby(http, lobby_config));
http.listen(port);
console.log('Lobby started at port '+port);

function shutdown()
{
	console.log('Lobby shutting down.');
	http.close(function() {
		process.exit(0);
	});
	setTimeout(function() {
		process.exit(0);
	}, Number(process.env.SHUTDOWN_TIMEOUT_MS || 10000));
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
