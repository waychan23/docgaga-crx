"use strict";

const $ = require('jquery');

module.exports = Keyword;

function Keyword(opts){
	if(!(this instanceof Keyword)){
		return new Keyword(opts);
	}

	var self = this;

	$.extend(self, opts);

	return Keyword.parse(self);
}

Keyword.prototype = {
	'pk': null,
	'object': {
		'user': null,
		'keyword': null,
		'relatedKeywordIds': [],
		'noteIds': [],
		'url': null,
		'createTime': null,
		'lastUpdateTime': null
	}
};

Keyword.schema = {
	'modelName': 'docgagakeywords',
	'autoIncrement': true,
	'indexes': [
		{ 'name': 'user',  'key': 'user' },
		{ 'name': 'keyword', 'key': 'keyword', 'opts': { 'unique': true } },
		{ 'name': 'createTime', 'key': 'createTime' },
		{ 'name': 'lastUpdateTime', 'key': 'lastUpdateTime' }
	]
};

Keyword.parse = function(self){
	self.object.noteIds = self.noteIds || [];
	self.object.relatedKeywords = self.relatedKeywords || [];

	return self;
};
