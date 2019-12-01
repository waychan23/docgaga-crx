"use strict";

const strUtils = require('./string-utils');

/*
const URL_PATTERN = {
	regex: /^((https?|file|chrome-extension|ftp)?:\/\/)?([^:\/]+)(:([0-9]+))?(\/[^\?#]*)*(\?[^#]*)?(#.*)?/,
	fieldIndexes: [
		{ 'field': 'protocol', 'index': 2 },
		{ 'field': 'host', 'index': 3 },
		{ 'field': 'port', 'index': 5, 'format': function(s){
			s = parseInt(s);
			if(!isNaN(s)){
				return s;
			}else{
				return undefined;
			}
		} },
		{ 'field': 'path', 'index': 6 },
		{ 'field': 'search', 'index': 7 },
		{ 'field': 'hash', 'index': 8 }
	]
};
*/

const URL_PATTERN = {
	regex: /^((https?|file|chrome-extension|ftp)?:\/\/)?(([^:\/]+)(:([0-9]+))?)?(\/[^\?#]*)*(\?[^#]*)?(#.*)?/,
	fieldIndexes: [
		{ 'field': 'protocol', 'index': 2 },
		{ 'field': 'origin' , 'index': 3 },
		{ 'field': 'host', 'index': 4 },
		{ 'field': 'port', 'index': 6, 'format': function(s){
			s = parseInt(s);
			if(!isNaN(s)){
				return s;
			}else{
				return undefined;
			}
		} },
		{ 'field': 'path', 'index': 7 },
		{ 'field': 'search', 'index': 8 },
		{ 'field': 'hash', 'index': 9 }
	]
};

const tmpls = {
	'link': (text) => `
    <a>${text}</a>
`
};

module.exports.composeUri = function(uri, query){
	var search = [],
		f;

	if(query){
		for(f in query){
			if(typeof query.hasOwnProperty != 'function' ||
			   query.hasOwnProperty(f)){
				search.push(f+'='+encodeURIComponent(query[f]));
			}
		}
		search = search.join('&');
	}

	if(!/\?$/.test(uri)){
		uri += '?';
	}

	return uri + search;
};

module.exports.normalizeUrl = normalizeUrl;

module.exports.getProtocol = getProtocol;

module.exports.normalEqual = function(u1, u2){
	if(!u1 || !u2){
		return u1 == u2;
	}

	u1 = normalizeUrl(u1);
	u2 = normalizeUrl(u2);

	return u1 == u2;
};

module.exports.getCurPageUrl = function(normailize){
	var url = window.location.href + '';
	if(normailize){
		url = normalizeUrl(url);
	}
	return url;
};

module.exports.parseUrl = parseUrl;

module.exports.getCurOrigin = function(loc){
	loc = loc || window.location;
	if(!loc.port ||
	   loc.protocol == 'http' && loc.port === 80 ||
	   loc.protocol == 'https' && loc.port === 443){
		return normalizeHost(loc.host);
	}
	return normalizeHost(loc.host) + ':' + loc.port;
};

module.exports.getCurHost = function(){
	var loc = window.location;
	return normalizeHost(loc.host);
};

module.exports.makeLink = function(text){
	return tmpls.link(text);
};

module.exports.getMaxCommonPrefix = function(url1, url2){
	if(!url1 || !url2){
		return '';
	}

	url1 = normalizeUrl(url1);
	url2 = normalizeUrl(url2);

	var prefix = strUtils.getMaxCommonPrefix(url1, url2);

	return prefix;
};

function normalizeHost(host){
	if(host && /^www\./.test(host) && host.replace(/[^\.]/g, '').length <= 2){
		host = host.replace(/^www\./, '');
	}
	return host;
}

function normalizeUrl(url){
	url = url || '';
	return url.replace(/^(https?|chrome-extension|file):\/\/(www\.)?|(\/)?#.*$|\/$/g, '');
}

function getProtocol(url){
	url = url || '';
	var m = url.match(/^([^:]+):/);
	if(m){
		return m[1];
	}
	return '';
}

function parseUrl(url){
	var m = url.match(URL_PATTERN.regex), o;
	if(!m){
		return null;
	}
	o = {};
	URL_PATTERN.fieldIndexes.forEach(f => o[f.field] = typeof f.format == 'function'? f.format(m[f.index]): m[f.index]);
	return o;
}
