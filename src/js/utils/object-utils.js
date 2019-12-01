"use strict";

module.exports = {
    'extend': extend
};

function extend(target, src){
    target = target || {};
    src = (Array.isArray(src)?src:[src]) || [];
    src.forEach(function(obj){
		var prop;
		for(prop in obj){
			if(obj.hasOwnProperty(prop)){
				target[prop] = obj[prop];
			}
		}
    });
    return target;
}
