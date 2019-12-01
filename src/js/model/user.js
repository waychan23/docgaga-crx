"use strict";

const $ = require('jquery');

module.exports = DocGagaUser;

function DocGagaUser(opts){
	if(!(this instanceof DocGagaUser)){
		return new DocGagaUser(opts);
	}

	var self = this;

	$.extend(self, opts);

	return DocGagaUser.parse(self);
}

DocGagaUser.prototype = {
	'pk': null,
	'object': {
		'username': null,
		'email': null,
		'phone': null,
		'lastLoginTime': null,
		'createTime': null
	}
};

DocGagaUser.parse = function(self){
	return self;
};
