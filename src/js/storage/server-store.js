"use strict";

const $ = require('jquery'),
	  Store = require('./store'),
	  urlUtils = require('../utils/url-utils'),
	  auth = require('../utils/auth-utils'),
	  msgService = require('../services/msg-service');

var initCheckLogin = false,
	loginUser;

module.exports = ServerStore;

function ServerStore(model, apis){
	if(!(this instanceof ServerStore)){
		return new ServerStore();
	}
	var self = this;

	self.model = model;
	self.apis = apis || {};

	return self;
}

ServerStore.prototype = Object.create(Store.prototype);

ServerStore.prototype._save = function(obj){
	var self = this,
		apis = self.apis;

	return checkLoginUser(self, function(){
		obj.url = urlUtils.getCurPageUrl(true);
		obj.pageTitle = document.title;

		return makePromise(apis.save, 'post', 'json', JSON.stringify(obj))
			.then(function(rs){
				if(!rs.result){
					return false;
				}
				return self.model({
					'pk': rs.result._id,
					'object': rs.result
				});
			});
	});
};

ServerStore.prototype._update = function(obj){
	var self = this,
		apis = self.apis;

	return checkLoginUser(self, function(){
		var doc;
		
		obj.object._id = obj.pk;

		return makePromise(apis.update, 'post', 'json', JSON.stringify(obj.object))
			.then(function(rs){
				if(!rs.result){
					return false;
				}
				return self.model({
					'pk': rs.result._id,
					'object': rs.result
				});
			});
	});
};

ServerStore.prototype._get = function(_id){
	var self = this,
		apis = self.apis;

	return checkLoginUser(self, function(){
		return makePromise(apis.findById, 'get', 'json', { '_id': _id })
			.then(function(rs){
				if(!rs.result){
					return null;
				}
				return self.model({
					pk: rs.result._id,
					object: rs.result
				});
			});

	});
};

ServerStore.prototype._delete = function(_id){
	var self = this,
		apis = self.apis;

	return checkLoginUser(self, function(){
		return makePromise(apis.delete, 'get', 'json', { '_id': _id }).then(function(rs){
			if(rs.result){
				return true;
			}
			return false;
		});
	});
};

ServerStore.prototype.search = function(query, opts){
	var self = this,
		apis = self.apis;

	opts = opts || {};

	return checkLoginUser(self, function(){
		return makePromise(apis.search, 'post', 'json', {
			query: query,
			pagination: opts.pagination,
			project: opts.project,
			sort: opts.sort
		}).then(function(rs){
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

ServerStore.prototype._makeAjaxPromise = makePromise;

ServerStore.prototype._checkLoginUser = checkLoginUser;

auth.getLoginUser(!'detail').then(function(user){
	if(!user){
		throw "未登录";
	}
	loginUser = user;
	initCheckLogin = true;
});

function checkLoginUser(self, success, forceRefreshTicket){
	return auth.getLoginUser('detail', null, forceRefreshTicket).then(function(user){
		if(!user){
			loginUser = false;
			throw "未登录";
		}

		loginUser = user;

		if(typeof success == 'function'){
			return success.call(self);
		}

		return Promise.resolve();
	});
}

function makePromise(api, method, dataType, data, retry){
	var params = {
		'api': api,
		'method': method,
		'dataType': dataType,
		'data': data,
		'loginUser': loginUser
	};

	return new Promise((resolve, reject) => {
		msgService.requestProxy('api-proxy', params, function(resp){
			if(resp.success) {
				resolve(resp);
			} else if (resp.error){
				handleErrorResponse(resp, resolve, reject);
			} else {
				reject("unknown error")
			}
		});
	});

	function handleErrorResponse(result, resolve, reject){
		if(result.error == 'need_login'){
			auth.needLogin();
			reject('need_login');
		}else if(result.error == 'need_refresh_ticket'){
			if(!retry){
				checkLoginUser(null, function(){
					resolve(makePromise(api, method, dataType, data, true));
				}, 'forceRefreshTicket');
				return;
			}
		}
		reject(result.error);
		return;
	}
}
