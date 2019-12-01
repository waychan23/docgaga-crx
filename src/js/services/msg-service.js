"use strict";

const cr = require('../utils/chrome'),
	  $ = require('jquery'),
	  runtime = require('../conf/runtime');

var listeners = {};
var initDone = false;

module.exports.sendMessage = function(msg, callback){
	cr.sendMessage(msg, callback);
};

module.exports.requestProxy = function(action, msg, callback, tabId){
	if(!action){
		return;
	}

	msg = msg || {};

	msg.action = action;

	if(runtime.requireEnv() === 'background'){
		localDispatch(msg, callback);
	} else {
		cr.sendMessage(msg, callback, tabId, null);
	}
};

module.exports.dispatch = function(action, msg, callback, tabId){
	if(!action){
		return;
	}

	msg = msg || {};

	msg.action = action;

	cr.sendMessage(msg, callback, tabId, null);
};

module.exports.listen = function(action, filter, callback){
	if(!action || !callback || (typeof callback != 'function' && typeof callback.callback != 'function')){
		return;
	}

	var added = false,
		arr;

	arr = listeners[action] = listeners[action] || [];

	added = arr.indexOf(callback) >= 0;

	if(added){
		return;
	}

	arr.push(callback);

	if(!initDone){
		cr.listenForMessage(null, function(msg, sender, sendResponse){
			if(!msg || !msg.action){
				return false;
			}

			var ls = listeners[msg.action],
				cb;

			if(ls && ls.length){
				ls.forEach(function(l){
					if(typeof l == 'function'){
						cb = l;
					}else if(l && (typeof l.filter != 'function' || l.filter(msg, sender))){
						cb = l.callback;
					}
				});
				return cb($.extend({}, msg), $.extend({}, sender), sendResponse);
			}

			return false;
		});

		initDone = true;
	}
};

function localDispatch(msg, callback){
	if(!msg || !msg.action){
		return false;
	}

	var ls = listeners[msg.action],
		cb;

	if(ls && ls.length){
		ls.forEach(function(l){
			if(typeof l == 'function'){
				cb = l;
			}else if(l && (typeof l.filter != 'function' || l.filter(msg, sender))){
				cb = l.callback;
			}
		});
		return cb($.extend({}, msg), null, function(resp){
			return callback.apply(null, [resp]);
		});
	}

	return false;
}