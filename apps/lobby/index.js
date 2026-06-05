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
var logger = createLogger({service:'f-lobby'});
var trustProxy = String(process.env.TRUST_PROXY || '').toLowerCase() === 'true';
var trustProxyHops = Number(process.env.TRUST_PROXY_HOPS || 1);

if( trustProxy) {
	if( !isFinite(trustProxyHops) || trustProxyHops < 1)
		trustProxyHops = 1;
	app.set('trust proxy', trustProxyHops);
}

var lobby_config = {
	public: opts.public || String(process.env.PUBLIC_LOBBY || '').toLowerCase() === 'true',
	protocol: null,
	trustProxy: trustProxy,
	trustProxyHops: trustProxyHops,
	allowedOrigins: process.env.ALLOWED_ORIGINS || '',
	roomTtlMs: Number(process.env.ROOM_TTL_MS || 0),
	maxRoomUsers: Number(process.env.MAX_ROOM_USERS || 0),
	logger: logger,
	loginRateLimitMax: Number(process.env.LOGIN_RATE_LIMIT_MAX || 0),
	loginRateLimitWindowMs: Number(process.env.LOGIN_RATE_LIMIT_WINDOW_MS || 60000),
	maxWsMessageSize: Number(process.env.MAX_WS_MESSAGE_SIZE || 0)
};

if( lobby_config.public)
	logger.info('lobby_mode_selected', {message:'public server', public:true});
else
	logger.info('lobby_mode_selected', {message:'private server', public:false});

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
	logger.info('transport_selected', {transport:'peerjs', message:'PeerJS transport'});
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
	logger.info('transport_selected', {transport:'websocket', message:'WebSocket transport'});
}

app.use('/', Lobby(http, lobby_config));
http.listen(port);
logger.info('lobby_started', {port:port, message:'Lobby started at port '+port});

function shutdown()
{
	logger.info('lobby_shutting_down', {message:'Lobby shutting down.'});
	http.close(function() {
		process.exit(0);
	});
	setTimeout(function() {
		process.exit(0);
	}, Number(process.env.SHUTDOWN_TIMEOUT_MS || 10000));
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

function createLogger(base)
{
	function write(level, event, fields)
	{
		var payload = {};
		for( var key in base)
			payload[key] = base[key];
		payload.timestamp = new Date().toISOString();
		payload.level = level;
		payload.event = event;
		fields = fields || {};
		for( var field in fields) {
			if( fields[field] instanceof Error) {
				payload[field] = {message:fields[field].message, stack:fields[field].stack};
			} else {
				payload[field] = fields[field];
			}
		}
		try {
			console.log(JSON.stringify(payload));
		} catch (err) {
			console.error('Failed to serialize log payload: '+(err && err.message ? err.message : String(err)));
		}
	}

	return {
		info: function(event, fields) { write('info', event, fields); },
		warn: function(event, fields) { write('warn', event, fields); },
		error: function(event, fields) { write('error', event, fields); }
	};
}
