"use strict";

const $ = require('jquery'),
	  cr = require('./chrome'),
	  msgService = require('../services/msg-service');

const PROP_USER_INFO = 'docgaga.user';

module.exports.saveLoginInfo = saveLoginInfo;
module.exports.getLoginUser = getLoginUser;
module.exports.onChanged = onChanged;
module.exports.needLogin = needLogin;
module.exports.login = login;
module.exports.logout = logout;

var cache = {},
	changeHandlers = [];

function needLogin(){
	delete cache.loginUser;
	logout();
}

function saveLoginInfo(loginInfo, callback){
	var props = {},
		t = new Date().getTime(),
		info;

	info = props[PROP_USER_INFO] = {
		'username': loginInfo.user.username,
		'avartar': loginInfo.user.avatar,
		'loginTicket': loginInfo.loginTicket,
		'apiTicket': loginInfo.apiTicket,
		'apiTicketExpiresAt': t + loginInfo.expiresIn - 1000 * 60,
		'refreshTicket': loginInfo.refreshTicket,
		'loginTime': t
	};

	return cr.removeProperties().then(function(){
		cr.setProperties(props).then(function(result){
			if(result){
				callback.call();
				cache.loginUser = info;
			}else{
				callback.call('error');
			}
		}).catch(function(e){
			callback.call(null, e);
		});
	});
}

function login(user){
	var props = {};

	props[PROP_USER_INFO] = {
		'username': user.username,
		'apiTicket': user.apiTicket,
		'loginTime': new Date().getTime(),
		'avartar': user.avartar
	};

	cache.loginUser = user;

	return cr.setProperties(props);
}

function logout(){
	return cr.removeProperties([PROP_USER_INFO]).then(function(rs){
		delete cache.loginUser;
		return rs;
	});
}

function isExpired(exp){
	if(exp instanceof Date){
		exp = exp.getTime();
	}
	return new Date().getTime() >= exp;
}

function refreshTicket(info){
	return new Promise(function(resolve, reject){
		msgService.requestProxy('refresh-api-ticket', info, function(resp){
			if(!resp){
				console.error('resp is empty');
				resolve(false);
				return;
			}

			if(resp.error){
				resolve(false);
			}else if(resp.apiTicket && resp.expiresIn){
				info = $.extend(info, {
					apiTicket: resp.apiTicket,
					expiresIn: resp.expiresIn,
					apiTicketExpiresAt: new Date().getTime() + resp.expiresIn
				});
				resolve(info);
			}else{
				resolve(false);
			}
		});
	}).then(function(info){
		var props;
		if(!info){
			delete cache.loginUser;
			return cr.removeProperties([PROP_USER_INFO])
				.then(function(){
					return false;
				});
		}else{
			props = {};
			props[PROP_USER_INFO] = info;
			
			return cr.setProperties(props)
				.then(function(result){
					if(result){
						cache.loginUser = info;
						return info;
					}
					return false;
				});
		}
	});
}

function getLoginUser(detail, callback, forceRefreshTicket){
	var cb, ret;

	cb = typeof callback == 'function';

	if(forceRefreshTicket){
		delete cache.loginUser;
	}

	if(cache.loginUser){
		if(isExpired(cache.loginUser.apiTicketExpiresAt)){
			delete cache.loginUser;
			return getLoginUser(detail, callback);
		}
		return Promise.resolve(cache.loginUser);
	}

	ret = cr.getProperties([PROP_USER_INFO]).then(function(info){
		info  = info[PROP_USER_INFO];

		if(!info || !info.username || !info.apiTicket){
			delete cache.loginUser;
			return false;
		}

		var r;

		if(forceRefreshTicket || isExpired(info.apiTicketExpiresAt)){
			r = refreshTicket(info);
		}else{
			r = Promise.resolve(info);
		}

		return r;
	});

	function then(info){
		if(!info){
			return false;
		}
		
		var user;
		
		cache.loginUser = info;

		if(!detail){
			user = {};

			user.username = info.username;
			user.apiTicket = info.apiTicket;

			return user;
		}else{
			return info;
		}
	}

	if(cb){
		ret.then(then).then(function(result){
			callback.call(null, null, result);
		}).catch(function(e){
			callback.call(null, e);
		});
	}else{
		return ret.then(then);
	}
};

function onChanged(callback){
	if(typeof callback == 'function' && changeHandlers.indexOf(callback) < 0){
		changeHandlers.push(callback);
	}
};

function callChangeHandlers(user){
	changeHandlers.forEach(function(handler){
		handler.call(null, user || false);
	});
}

chrome.storage.onChanged.addListener(function(changes, areaName){
	if(changes[PROP_USER_INFO]){
		cache.loginUser = changes[PROP_USER_INFO].newValue;
		callChangeHandlers(cache.loginUser);
	}
});
