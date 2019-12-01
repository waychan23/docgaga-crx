"use strict";

const urlUtils = require('../utils/url-utils'),
	  msgService = require('../services/msg-service');

module.exports.queryByIds = function(msg){
	return new Promise(function(resolve, reject){
		msgService.dispatch('query-keywords-by-ids', {
			'ids': msg.ids
		}, function(msg){
			if(msg && msg.success){
				resolve(msg);
			}else{
				resolve(false);
			}
		});
	});
};

module.exports.getSuggestions = function(info){
	return new Promise(function(resolve, reject){
		msgService.dispatch('get-keyword-suggestions', {
			'url': urlUtils.getCurPageUrl(),
			'pageTitle': document.title,
			'text': info.text,
			'note': info.note
		}, function(msg){
			if(msg && msg.success){
				resolve(msg);
			}else{
				resolve(false);
			}
		});
	});
};

module.exports.updateKeywordCache = function(keywords){
	return new Promise(function(resolve, reject){
		msgService.dispatch('update-keyword-cache', {
			'url': urlUtils.getCurPageUrl(),
			'pageTitle': document.title,
			'keywords': keywords
		}, function(msg){
			if(msg && msg.success){
				resolve(true);
			}else{
				resolve(false);
			}
		});
	});
};
