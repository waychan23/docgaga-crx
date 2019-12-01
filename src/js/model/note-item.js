"use strict";

const $ = require('jquery'),
	  nodePathUtils = require('../utils/node-path-utils'),
	  urlUtils = require('../utils/url-utils');

const curPageUrl = urlUtils.getCurPageUrl.bind(null, true),
	  curHost = urlUtils.getCurHost,
	  curOrigin = urlUtils.getCurOrigin;

module.exports = NoteItem;

function NoteItem(opts){
	if(!(this instanceof NoteItem)){
		return new NoteItem(opts);
	}

	var self = this;

	$.extend(self, opts);

	return NoteItem.parse(self);
}

NoteItem.parse = function(obj){
	if(!(obj instanceof NoteItem)){
		obj = new NoteItem(obj);
	}

	obj.object.keywords = obj.object.keywords || [];
	obj.inCurPage = obj.object.url && obj.object.url == curPageUrl();
	obj.inCurSite = obj.object.url && obj.object.url.indexOf(curHost()) === 0;

	if(obj.inCurPage === undefined || obj.inCurPage && !obj.range && obj.object && obj.object.startPath && obj.object.endPath){
		obj.range = nodePathUtils.toRange(obj.object.startPath, obj.object.startOffset, obj.object.endPath, obj.object.endOffset);
	}

	if(obj.object.lastUpdateTime && typeof obj.object.lastUpdateTime == 'string'){
		obj.object.lastUpdateTime = new Date(Date.parse(obj.object.lastUpdateTime));
	}

	if(obj.object.createTime && typeof obj.object.createTime == 'string'){
		obj.object.createTime = new Date(Date.parse(obj.object.createTime));
	}

	return obj;
};

NoteItem.prototype = {
	'pk': null,
	'range': null,
	'inCurPage': false,
	'object': {
		'user': null,
		'keywords': [],
		'text': null,
		'note': null,
		'url': null,
//		'type': null,
		'pageTitle': null,
		'noteType': null,
		'startOffset': null,
		'startPath': null,
		'endPath': null,
		'endOffset': null,
		'createTime': null,
		'lastUpdateTime': null
	}
};

NoteItem.prototype.parse = function(){
	var self = this;
	return NoteItem.parse(self);
};

NoteItem.schema = {
	'modelName': 'docgaganotes',
	'autoIncrement': true,
	'indexes': [
		{ 'name': 'user', 'key': 'user' },
		{ 'name': 'url', 'key': 'url' },
//		{ 'name': 'type', 'key': 'type' },
		{ 'name': 'pageTitle', 'key': 'pageTitle' },
		{ 'name': 'noteType', 'key': 'noteType' },
		{ 'name': 'startPath', 'key': 'startPath' },
		{ 'name': 'endPath', 'key': 'endPath' },
		{ 'name': 'createTime', 'key': 'createTime' },
		{ 'name': 'lastUpdateTime', 'key': 'lastUpdateTime' }
	]
};
