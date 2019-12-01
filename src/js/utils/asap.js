"use strict";

module.exports = asap;

function asap(callback, thisObj, args){
	if(!callback || typeof callback != 'function'){
		return false;
	}

	if(args && !Array.isArray(args)){
		args = [args];
	}

	setTimeout(function(){
		callback.apply(thisObj, args || []);
	}, 0);

	return true;
}
