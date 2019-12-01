"use strict";

require('./conf/runtime').setEnv('background');

var $ = require('jquery'),	
    urlUtils = require('./utils/url-utils'),
	cr = require('./utils/chrome'),
	msgService = require('./services/msg-service'),
	keywordServer = require('./services/keyword-service-server'),
	aclUtils = require('./utils/acl-utils'),
	config = require('./conf/config');

var apis = updateAPI(config.local);

var	mq = {
	initOpen: {}
};

config.on('update', function(conf){
	return $.extend(apis || {}, updateAPI(conf));
});

function updateAPI(localConfig){
	return {
		'refreshTicket': config.local.endpoint.refreshTicket
	};
}

msgService.listen('query-keywords-by-ids', !'filter', function(msg, sender, sendResponse){
	keywordServer.queryByIds(msg).then(function(rs){
		if(rs){
			sendResponse({ success: true, result: rs });
		}else{
			sendResponse({ error: 'unknown' });
		}
	});
	return true;
});

msgService.listen('get-keyword-suggestions', !'filter', function(msg, sender, sendResponse){
	try{
		var rs = keywordServer.getSuggestions(msg);
		if(rs){
			sendResponse({ success: true, result: rs });
		}else{
			sendResponse({ error: 'unknown' });
		}
	}catch(e){
		console.error(e);
		sendResponse({ error: e });
	}
});

msgService.listen('update-keyword-cache', !'filter', function(msg, sender, sendResponse){
	try{
		keywordServer.updateCache(msg);
		sendResponse({ success: true });
	}catch(e){
		console.error(e);
		sendResponse({ error: e });
	}
});

msgService.listen('open-tab', !'filter', function(msg, sender, sendResponse){
	if(!msg || !msg.url){
		sendResponse({ error: 'Error: msg.url not presents' });
		return;
	}

	if(msg.noteId){
		produceMsg('initOpen', urlUtils.normalizeUrl(msg.url), msg.noteId);
	}

	cr.openTab(msg.url, function(win){
		sendResponse({ success: true });
	}, !!msg.alwaysOpenNew);
	
});

msgService.listen('init-open', !'filter', function(msg, sender, sendResponse){
	if(!msg || !msg.url){
		sendResponse({ error: 'Error: msg.url not presents' });
		return;
	}

	var noteId = comsumeMsg('initOpen', urlUtils.normalizeUrl(msg.url));

	sendResponse({ noteId: noteId });
});

msgService.listen('get-active-page-accessibility', !'filter', function(msg, sender, sendResponse){
	cr.getCurrentTab(function(tab){
		if(!tab){
			sendResponse({ error: 'no tab currently active' });
		}else{
			msgService.dispatch('check-launched', {}, function(rs){
				if(!rs){
					sendResponse({ error: 'unknown' });
				}else if(rs.launched === true){
					sendResponse({ accessible: true });
				}else if(rs.launched === false){
					sendResponse({ accessible: false });
				}else{
					sendResponse({ error: 'unknown' });
				}
			}, tab.id);
		}
	});
	return true;
});

msgService.listen('allow-cur-page', '!filter', function(msg, sender, sendResponse){
	cr.getCurrentTab(function(tab){
		if(!msg){
			sendResponse({ error: 'invalid message' });
		}else if(!tab){
			sendResponse({ error: 'no tab currently active' });
		}else{
			msgService.dispatch('bootstrap', {}, function(rs){
				if(!rs){
					sendResponse({ error: 'unknown' });
				}else if(rs.success){
					sendResponse({ success: true });
				}else{
					sendResponse({ error: 'unknown' });
				}
			}, tab.id);
			//forget about persistence failure
			if(msg.persistent){
				aclUtils.addWhitelistItem({ url: tab.url, type: msg.type == 'page'? 'page': 'site', name: (tab.title || '').trim() });
			}
		}
	});
	return true;
});

msgService.listen('block-cur-page', '!filter', function(msg, sender, sendResponse){
	cr.getCurrentTab(function(tab){
		if(!msg){
			sendResponse({ error: 'invalid message' });
		}else if(!tab){
			sendResponse({ error: 'no tab currently active' });
		}else{
			msgService.dispatch('destroy', {}, function(rs){
				if(!rs){
					sendResponse({ error: 'unknown' });
				}else if(rs.success){
					sendResponse({ success: true });
				}else{
					sendResponse({ error: 'unknown' });
				}
			}, tab.id);
			//forget about persistence failure
			if(msg.persistent){
				aclUtils.addBlacklistItem({ url: tab.url, type: msg.type == 'page'? 'page': 'site', name: (tab.title || '').trim() });
			}
		}
	});
	return true;
});

msgService.listen('api-proxy', null, function(params, sender, sendResponse){
	var api = params.api,
		method = params.method, 
		dataType = params.dataType, 
		data = params.data, 
		loginUser = params.loginUser;

	method = method || 'get';
	dataType = dataType || 'json';

	if(method == 'post' && dataType == 'json' && typeof data == 'object'){
		data = JSON.stringify(data);
	}

	$.ajax({
		url: api,
		method: method,
		dataType: dataType,
		data: data || {},
		crossDomain: true,
		xhrFields: {
			withCredentials: true
		},
		contentType: method == 'post'? 'application/json': 'application/x-www-form-urlencoded',
		beforeSend: function(xhr){
			xhr.setRequestHeader('x-username', loginUser.username);
			xhr.setRequestHeader('x-api-ticket', loginUser.apiTicket);
		},
		success: function(result){
			if(!result){
				sendResponse({ "error": 'noresult' });
			} else if(result.error || !result.success) {
				sendResponse(result)
			} else if(result && result.success){
				sendResponse(result);
			}
		},
		error: function(a, b, c){
			if(a.responseJSON && a.responseJSON.error){
				sendResponse({ "error": a.responseJSON })
			}else{
				sendResponse({ "error": "unknown_error" });
			}
		}
	});

	return true;
});

msgService.listen('refresh-api-ticket', null, function(info, sender, sendResponse){
	$.ajax({
		url: apis.refreshTicket,
		data: { 'ticket': info.loginTicket },
		beforeSend: function(xhr){
			xhr.setRequestHeader('x-refresh-ticket', info.refreshTicket);
		},
		success: function(resp){
			sendResponse(resp);
		},
		error: function(err){
			sendResponse({ "error": err })
		}
	});

	return true;
});

cr.onUrlChange(function(tabId, changeInfo, tab){
	msgService.dispatch('change-url', {}, null, tabId);
});

function produceMsg(topic, key, val){
	if(topic && key && mq[topic]){
		mq[topic][key] = val;
	}
}

function comsumeMsg(topic, key){
	var val;
	if(topic && key && mq[topic] && mq[topic][key]){
		val = mq[topic][key];
		delete mq[topic][key];
	}
	return val;
}
