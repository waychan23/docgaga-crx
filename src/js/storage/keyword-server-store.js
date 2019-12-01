"use strict";

const $ = require('jquery'),
	  ServerStore = require('./server-store'),
	  Keyword = require('../model/keyword'),
	  config = require('../conf/config');

function a(path){
	return config.apiUrl(null, '/docgagacrx/api'+path);
}

var apis = updateAPI(config.local);

config.on('update', function(conf){
	return $.extend(apis || {}, updateAPI(conf));
});

module.exports = KeywordServerStore;

function updateAPI(localConfig){
	return {
		save: a('/keyword/add'),
		findById: a('/keyword/findById'),
		list: a('/keyword/list'),
		search: a('/keyword/search')
	};
}

function KeywordServerStore(){
	var self = this;

	if(!(self instanceof KeywordServerStore)){
		return new KeywordServerStore();
	}

	self._super = Object.getPrototypeOf(KeywordServerStore.prototype);

	return self;
}

KeywordServerStore.prototype = Object.create(new ServerStore(Keyword, apis));
