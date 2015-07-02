/**
 * Transmission API client
 * 
 * @author Belkacem Alidra <belkacem.alidra@gmail.com>
 * 
 * Minimum API calls to manage the bittorrent client downloads.
 * Work is still in progress ...

 * @param {Object} connection: The connexion properties
 */
function api(connection) {
	
	this.connection		= connection;
	this.connection.url	= 'http://' + this.connection.host + ':' + this.connection.port + '/transmission/rpc';
	
	this.session_id	= Ti.App.Properties.getString('session_id');	
	
	this.status = {
		"TR_STATUS_STOPPED"        : 0, /* Torrent is stopped */
		"TR_STATUS_CHECK_WAIT"     : 1, /* Queued to check files */
		"TR_STATUS_CHECK"          : 2, /* Checking files */
		"TR_STATUS_DOWNLOAD_WAIT"  : 3, /* Queued to download */
		"TR_STATUS_DOWNLOAD"       : 4, /* Downloading */
		"TR_STATUS_SEED_WAIT"      : 5, /* Queued to seed */
		"TR_STATUS_SEED"           : 6  /* Seeding */	
	};
}

/**
 * Start one or several downloads
 * 
 * @param {Array} ids: The downloads ids to start
 * @param {Function} callback: Callback function
 */
api.prototype.start = function(ids, callback) {
	var args = {};
	if (ids != null) {
		args.ids = ids;
	}
	this.query("torrent-start", { args: args }, callback);
};

/**
 * Stop one or several downloads
 * 
 * @param {Array} ids: The downloads ids to stop
 * @param {Function} callback: Callback function
 */
api.prototype.stop = function(ids, callback) {
	var args = {};
	if (ids != null) {
		args.ids = ids;
	}
	this.query("torrent-stop", { args: args }, callback);
};

/**
 * Add one torrent to the download queue
 * 
 * @param Object options: The torrent informations
 * This object can contain these keys:
 * 	- filename: The URL to the torrent file
 *  - metainfo: The torrent file content, as an unencoded string
 *  - downloadDir: The directory where to download the file, as a path
 *  - paused: A boolean to automatically start the download
 * 
 * @param {Function} callback: Callback function
 */
api.prototype.addTorrent = function(options, callback) {
	var args = {
		"paused": options.paused || 0,
		"metainfo": options.data || null
	};
	
	if (!_.isEmpty(options.url))
		args['filename'] = options.url;
		
	if (!_.isEmpty(options.downloadDir))
		args['download-dir'] = options.downloadDir;
		
	this.query("torrent-add", { args: args }, callback);
};

/**
 * Load the torrents in the queue
 * 
 * @param {Function} callback: Callback function
 */
api.prototype.loadTorrents = function(callback) {
	this.query("torrent-get", { args: { "fields": [ "id", "name", "status", "isFinished", "isStalled", "percentDone", "downloadedEver", "sizeWhenDone", "rateDownload", "rateUpload", "eta" ] }}, callback);
};

/**
 * Load the torrents statistics
 * 
 * @param {Function} callback: Callback function
 */
api.prototype.loadStats = function(callback) {
	this.query("session-stats", {}, callback);	
};

/**
 * Get the default download directory
 * 
 * @param {Function} callback: Callback function
 */
api.prototype.getDefaultDownloadDir = function(callback) {
	this.query("session-get", {}, callback);
};

/**
 * Requests a new session id
 * 
 * @param {Function} callback: Callback function
 */
api.prototype.getNewSessionId = function(callback) {
	this.query(null, { getSessionId: true }, callback);
};

/**
 * Get the default download directory
 * 
 * @param {Function} callback: Callback function
 */
api.prototype.query = function(method, options, callback) {
	var self = this;
	if (!Ti.Network.online) {
		callback && (callback({"error": "No connection"}));
		return;
	}
	
	var args	= options.args || {};
	var headers	= options.headers || {};
	 
	var xhr = Titanium.Network.createHTTPClient({
		onload: function() {
			Ti.App.Properties.setString('session_id', xhr.getResponseHeader('X-Transmission-Session-Id'));
			callback && callback(null, JSON.parse(this.responseText));
		},
		onerror: function(e) {
			/* 409 Error: we must change our X-Transmission-Session-Id */
			if(xhr.getStatus() == 409) {
				var new_session_id = xhr.getResponseHeader('X-Transmission-Session-Id');
				
				if (new_session_id == self.session_id)
					alert('Une erreur bizarre est survenue ...');
				else {
					self.session_id = new_session_id;
					Ti.API.info('Got new X-Transmission-Session-Id' + self.session_id);
					if (options.getSessionId)
						callback && callback(null, { sessionId: self.session_id });
					else
						self.query(method, options, callback);
				}
			}
			else {
				Ti.API.error('API call failed');
				Ti.API.error(e.source.responseText);
				Ti.API.error([method, options]);
				callback && (callback(e));
			}
		},
		timeout: 5000
	});
	
	if (OS_IOS)
		xhr.open("POST", this.connection.url);
		
	xhr.setUsername(this.connection.user);
	xhr.setPassword(this.connection.pass);
	xhr.setRequestHeader('X-Transmission-Session-Id', this.session_id);
	_.each(options.headers, function(h) {
		xhr.setRequestHeader(h.key, h.value);
	});
	
	if (!OS_IOS)
		xhr.open("POST", this.connection.url);
		
	var payload = {
		"method": method,
		"arguments": args
	};
	
	xhr.send(JSON.stringify(payload));
};

module.exports = api;
