"use strict";

const $ = require('jquery'),
	  cr = require('../utils/chrome');

var p;
var useOrigin = 'api.docgaga.club:8443'; //TODO 需填写
var useProtocol = 'https';

var docgagaSiteInfo = {
	'protocol': useProtocol,
	'origin': useOrigin,
	'contextPath': '/docgaga'
};

p = makePrefixer(docgagaSiteInfo);

docgagaSiteInfo.endpoint = {
	'signupPage': p('/public/signup.html'),
	'mainPage': p('/public/index.html')
};

var crxServerInfo = {
	'protocol': useProtocol,
	'origin': useOrigin,
	'authOrigin': useOrigin,
	'contextPath': '/docgagacrx'
};

p = makePrefixer(crxServerInfo);

crxServerInfo.endpoint = {
	'settingPage': cr.url('settings.html'),
	'loginPage': cr.url('oauth-login.html'),
	'login': p('/auth/login'),
	'logout': p('/auth/logout'),
	'check': p('/auth/check'),
	'auth': p('/auth'),
	'refreshTicket': p('/auth/refreshTicket')
};

crxServerInfo.apis = {
	'translate': p('/openapi/translate')
};

var links = {
	'notebook': ''
};

var config = {
	'default': $.extend({}, crxServerInfo, {
		'docgagaSiteInfo': docgagaSiteInfo,
		'links': links
	})
};

config.local = $.extend({}, config.default);

var eventHandlers = {};

function makePrefixer(o){
	return function(path){
		return o.protocol+'://'+o.origin+o.contextPath+path;
	};
}

function updateLocal(){
	getOrigin().then(function(origin){
		if(!origin){
			setOrigin(config.default.origin);
			origin = config.default.origin;
		}
		return origin;
	}).then(function(origin){
		config.local = $.extend(config.local, {
			'origin': origin
		});
		emit('update');
	});
}

function emit(name){
	if(name && Array.isArray(eventHandlers[name]) && eventHandlers[name].length){
		eventHandlers[name].forEach(function(h){
			h.call(null, $.extend({}, config.local));
		});
	}
}

function on(name, handler){
	if(name && typeof handler == 'function'){
		eventHandlers[name] = eventHandlers[name] || [];
	}
	eventHandlers[name].push(handler);
}

function apiUrl(protocol, path){
//	return config.local.origin+path;
    protocol = protocol || 'https';
	return protocol+'://'+config.local.origin+path;
}

function setOrigin(origin){
	return cr.setProperties({ 'docgaga.origin': origin });
}

function getOrigin(){
	return cr.getProperties(['docgaga.origin']).then(function(obj){
		return obj['docgaga.origin'];
	});
}

function setAuthOrigin(authOrigin){
	return cr.setProperties({ 'docgaga.authOrigin': authOrigin });
}

function getAuthOrigin(){
	return cr.getProperties(['docgaga.authOrigin']).then(function(obj){
		return obj['docgaga.authOrigin'];
	});
}

updateLocal();

chrome.storage.onChanged.addListener(function(changes){
	updateLocal();
});

module.exports = {
	'def': $.extend({}, config.default),
	'local': $.extend({}, config.local),
	'apiUrl': apiUrl,
	'on': on,
	'setOrigin': setOrigin,
	'getOrigin': getOrigin,
	'getAuthOrigin': getAuthOrigin,
	'setAuthOrigin': setAuthOrigin
};
