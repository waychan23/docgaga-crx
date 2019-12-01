"use strict";

/*
 * 转义普通字符串中的特殊字符，结果可用于被RegExp转换成一个可以用于进行该字符串“包含”匹配的正则表达式，例如：
 * 字符串 var str = contains("^f\d[A-z]\\$"); // => "\\fd\\[A\\-\\]\\\\\\$"
 * 正则表达式 var re = RegExp(str); // => /fd\[A\-z\]\\\$/
 * 匹配 re.test(str); // => true
 */
module.exports.contains = function contains(str){
	str = str || '';

	str = str.replace(/\\/g, '\\\\').replace(/([\*\^\$\|\{\}\[\]\(\)\+\-\.\?\/])/g, '\\$1');

	return str;
};
