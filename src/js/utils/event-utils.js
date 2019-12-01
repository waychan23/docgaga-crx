"use strict";

module.exports.preventDefaultAndStopPropagation = function (event){
	if(event){
		try{
			if(typeof event.stopPropagation == 'function'){
				event.stopPropagation();
			}
			if(typeof event.preventDefault == 'function'){
				event.preventDefault();
			}
		}catch(e){
			console.debug(e);
		}
	}
}