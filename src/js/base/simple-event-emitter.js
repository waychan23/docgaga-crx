"use strict";

module.exports = SimpleEventEmitter;

function SimpleEvent(obj){
	
    var eventPrototype = {
        'stopPropagation': function(){
            this.propagationStopped = true;     
        }
    }, 
		event = Object.create(eventPrototype); 
    
    for(let prop in obj){
        if(obj.hasOwnProperty(prop)){
            event[prop] = obj[prop]; 
        } 
    }

    return event;
}

function SimpleEventEmitter(){
	var self = this;

	self._eventHandlers = {};
}

SimpleEventEmitter.prototype = {};

SimpleEventEmitter.prototype.on
	= SimpleEventEmitter.prototype.addEventHandler
	= function(eventName, eventHandler){
		if(!eventName || !eventHandler){
			return false; 
		}
		this._eventHandlers[eventName] = this._eventHandlers[eventName] || []; 
		this._eventHandlers[eventName].push(eventHandler);
		return true;
	};

SimpleEventEmitter.prototype.off
	= SimpleEventEmitter.prototype.removeEventHandler
	= function(eventName, eventHandler){
		if(!eventName && !eventHandler && !this._eventHandlers[eventName]){
			return; 
		} 
		if(!eventHandler){
			delete this._eventHandlers[eventName]; 
			return;
		}
		this._eventHandlers[eventName] = this._eventHandlers[eventName].filter(function(handler){
			return handler !== eventHandler;        
		});
	};

SimpleEventEmitter.prototype.clearHandlers = function(){
	this._eventHandlers = {};
};

SimpleEventEmitter.prototype.fireEvent
	= SimpleEventEmitter.prototype.emit
	= function(eventName, eventObj, opts){
		opts = opts || {};

		if(!eventName || !this._eventHandlers[eventName] || !this._eventHandlers[eventName].length){
			return; 
		}
		eventObj = new SimpleEvent(eventObj || {}); 
		
		if(opts.async){
			Promise.resolve().then(handle.bind(this));
		}else{
			handle.call(this);
		}

		function handle(){
			var i, handler;
			for(i=0; i<this._eventHandlers[eventName].length; i++){
				handler = this._eventHandlers[eventName][i]; 
				handler.apply(null, [eventObj]);
				if(this.propagationStopped){
					break; 
				} 
			}
		}
	};

SimpleEventEmitter.prototype.emitFirst
	= SimpleEventEmitter.fireFirst
	= function(eventName, eventObj, opts){
		opts = opts || {};

		if(!eventName || !this._eventHandlers[eventName] || !this._eventHandlers[eventName].length){
			return null; 
		}
		eventObj = new SimpleEvent(eventObj || {}); 

		let handler = this._eventHandlers[eventName][0],
			ret;

		if(opts.async){
			ret = Promise.resolve().then(() => handler.apply(null, [eventObj]));
		}else{
			ret = handler.apply(null, [eventObj]);
		}

		return ret;
	};
