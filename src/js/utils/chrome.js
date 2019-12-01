"use strict";

const urlUtils = require('./url-utils'),
	  reUtils = require('./regex-utils');

const storage = chrome.storage,
	  runtime = chrome.runtime,
	  ext = chrome.extension;

module.exports.onUrlChange = function(handler){
	chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab){
		if(changeInfo.status == 'complete'){
			handler.call(null, tabId, changeInfo, tab);
		}
	});
};

module.exports.onMessage = function(callback){
	if(typeof callback == 'function'){
		chrome.runtime.onMessage.addListener(callback);
	}
};

module.exports.onClickBrowserAction = function(callback){
	if(typeof callback == 'function'){
		chrome.browserAction.onClicked.addListener(callback);
	}
};

module.exports.removeProperties = function(props){
	props = [].concat(props).filter(Boolean);

	if(!props.length){
		return Promise.resolve(true);
	}

	return new Promise(function(resolve, reject){
		storage.local.remove(props, function(){
			if(runtime.lastError){
				reject(runtime.lastError);
			}
			resolve(true);
		});
	});
};

module.exports.clearProperties = function(){
	return new Promise(function(resolve, reject){
		storage.local.clear(function(){
			if(runtime.lastError){
				reject(runtime.lastError);
			}
			resolve(true);
		});
	});
};

module.exports.getProperties = function(props){
	props = [].concat(props).filter(Boolean);

	if(!props || !props.length){
		return Promise.resolve([]);
	}

	return new Promise(function(resolve, reject){
		storage.local.get(props, function(objects){
			if(runtime.lastError){
				reject(runtime.lastError);
				return;
			}
			resolve(objects);
		});
	});
};

module.exports.setProperties = function(props){
	var count = 0,
		prop;

	props = props || {};

	for(prop in props){
		if(props.hasOwnProperty(prop)){
			count ++;
			break;
		}
	}

	if(count === 0){
		return Promise.resolve(true);
	}

	return new Promise(function(resolve, reject){
		storage.local.set(props, function(){
			if(runtime.lastError){
				reject(runtime.lastError);
				return;
			}
			resolve(true);
		});
	});
};

module.exports.url = function(url){
	return ext.getURL(url);
};

module.exports.getCurrentTab = function(callback){
	if(typeof callback == 'function'){
		chrome.tabs.query({
			lastFocusedWindow: true
		}, function(tabs){
			if(!tabs || !tabs.length){
				callback(null);
			}else{
				callback(tabs.filter(function(t){
					return t.highlighted;
				})[0] || null);
			}
		});
	}
};

module.exports.openTab = function(url, callback, alwaysOpenNew){
	var cb = function(win){
		if(typeof callback == 'function' && win){
			callback.call(null, win);
		}
	};

	if(!url){
		return;
	}
	if(alwaysOpenNew){
		cb(window.open(url));
		return;
	}

	chrome.tabs.query({} , function(tabs){
		var patt = RegExp(reUtils.contains(urlUtils.normalizeUrl(url))+"\/?(#.*)?$"),
			tar;

		tabs = (tabs || []).filter(function(tab){
			return patt.test(tab.url);
		});

		if(!tabs.length){
			cb(window.open(url));
		}else{
			chrome.tabs.highlight({
				tabs: tabs[0].index
			}, cb);
		}
	});
};

module.exports.sendMessage = function(msg, callback, tabId, opts){
	if(!msg){
		return;
	}
	if(tabId !== undefined && tabId !== null){
		chrome.tabs.sendMessage(tabId, msg, opts, callback);
	}else{
		runtime.sendMessage(msg, callback);
	}
};

module.exports.listenForMessage = function(filter, callback){
	if(typeof callback != 'function'){
		return false;
	}
	runtime.onMessage.addListener(function(msg, sender, sendResponse){
		if(typeof filter != 'function' || filter(msg, sender)){
			return callback(msg, sender, sendResponse);
		}
		return false;
	});

	return false;
};
