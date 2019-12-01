"use strict";

const urlUtils = require('../utils/url-utils'),
	  msgService = require('../services/msg-service');

module.exports.openNoteInPage = function(url, noteId, opts){
	opts = opts || {};

	opts.alwayOpenNew = typeof opts.alwayOpenNew == 'boolean'? opts.alwayOpenNew: false;

	if(!url || !noteId){
		return;
	}

	msgService.dispatch('open-tab', { url: url, 'noteId': noteId });
};

module.exports.checkRemoteOpen = function(callback){
	if(typeof callback != 'function'){
		return;
	}
	
	msgService.dispatch('init-open', { 'url': urlUtils.getCurPageUrl(true) }, function(msg){
		callback(msg);
	});
};
