"use strict";

var html5 = require('html-entities').Html5Entities;

module.exports.escapeHTML = function(str){
	return html5.encode(str || '');
};

module.exports.getMaxCommonPrefix = function(str1, str2){
	str1 = str1 || '';
	str2 = str2 || '';

	var i, ch1, ch2,
		rs = [];

	for(i = 0; i < Math.min(str1.length, str2.length); i++){
		ch1 = str1.charAt(i);
		ch2 = str2.charAt(i);

		if(ch1 == ch2){
			rs.push(ch1);
		}else{
			break;
		}
	}

	return rs.join('');
};
