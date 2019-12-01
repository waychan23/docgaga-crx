"use strict";

module.exports.since = function(time, dateSeparator, padZero){
	if(!time){
		return '';
	}

	dateSeparator = dateSeparator || '-';

	var now = new Date(),
		dt = now.getTime() - time.getTime(),
		y, M, d;

	if(dt < 0){
		return '-';
	}

	if(dt < 1000 * 60){
		return '刚刚';
	}

	if(dt < 1000 * 60 * 60){
		return Math.floor(dt / 1000 / 60) + '分钟前';
	}

	if(dt < 1000 * 60 * 60 * 24){
		return Math.floor(dt / 1000 / 60 / 60) + '小时前';
	}

	if(dt < 1000 * 60 * 60 * 24 * 60){
		return Math.floor(dt / 1000 / 60 / 60 / 24) + '天前';
	}

	y = padZero?leftPadStr(time.getFullYear(), '0', 2): time.getFullYear();
	M = padZero?leftPadStr(time.getMonth() + 1, '0', 2): time.getMonth();
	d = padZero?leftPadStr(time.getDate(), '0', 2): time.getDate();

	if(now.getFullYear() === time.getFullYear() &&
	   now.getMonth() > time.getMonth()){
		return [M, d].join(dateSeparator);
	}

	return [y, M, d].join(dateSeparator);
};

module.exports.dateTime = function(time, dateSeparator, padZero){
	if(!time){
		return '';
	}

	dateSeparator = dateSeparator || '-';

	var y = time.getFullYear(),
		M = padZero?leftPadStr(time.getMonth() + 1, '0', 2): time.getMonth(),
		d = padZero?leftPadStr(time.getDate(), '0', 2): time.getDate(),
		h = padZero?leftPadStr(time.getHours(), '0', 2): time.getHours(),
		m = padZero?leftPadStr(time.getMinutes(), '0', 2): time.getMinutes(),
		s = padZero?leftPadStr(time.getSeconds(), '0', 2): time.getSeconds();
	
	return [y, M, d].join(dateSeparator)+' '+[h, m, s].join(':');
};

function leftPadStr(str, padChar, padToLength){
	if(str === undefined || str === null){
		return str;
	}

	str = str + '';

	if(!str.length){
		return str;
	}

	var len = padToLength - str.length;

	if(len <= 0){
		return str;
	}
	
	while(len > 0){
		str = padChar + str;
		len --;
	}

	return str;
}
