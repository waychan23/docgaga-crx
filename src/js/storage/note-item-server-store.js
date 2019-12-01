"user strict";

const $ = require('jquery'),
	  ServerStore = require('./server-store'),
	  NoteItem = require('../model/note-item'),
	  config = require('../conf/config');

function a(path){
	return config.apiUrl(null, '/docgagacrx/api'+path);
}

var apis = updateAPI(config.local);

config.on('update', function(conf){
	return $.extend(apis || {}, updateAPI(conf));
});

module.exports = NoteItemServerStore;

function updateAPI(localConfig){
	return {
		save: a('/note/add'),
		update: a('/note/update'),
		delete: a('/note/delete'),
		findById: a('/note/findById'),
		list: a('/note/list'),
		search: a('/note/search'),
		findByMark: a('/note/findByMark'),
		count: a('/note/count')
	};
}

function NoteItemServerStore(){
	var self = this;

	if(!(self instanceof NoteItemServerStore)){
		return new NoteItemServerStore();
	}

	self._super = Object.getPrototypeOf(NoteItemServerStore.prototype);

	return self;
}

NoteItemServerStore.prototype = Object.create(new ServerStore(NoteItem, apis));

NoteItemServerStore.prototype.count = function(opts){
	opts = opts || {};

	var self = this,
		apis = self.apis;

	return self._checkLoginUser(self, function(){
		return self._makeAjaxPromise(apis.count, 'get', 'json')
			.then(function(rs){
				if(rs && rs.result !== null && rs.result !== undefined){
					if(isNaN(rs.result)){
						rs = -1;
					}else{
						rs = rs.result;
					}
				}
				return rs;
			});
	});
};

NoteItemServerStore.prototype.findByMark = function(mark, opts){
	if(!mark){
		return false;
	}

	var self = this,
		apis = self.apis;

	opts = opts || {};

	return self._checkLoginUser(self, function(){
		return self._makeAjaxPromise(apis.findByMark, 'post', 'json', mark)
			.then(function(rs){
				if(rs){
					if(rs.result && Array.isArray(rs.result)){
						rs.result = rs.result.map(o => self.model({ pk: o._id, object: o }));
					}
					delete rs.msg;
				}

				return rs;
			});
	});
};
