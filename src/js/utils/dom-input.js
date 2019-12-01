"use strict";

var $ = require('jquery');

const KEY_CODE_ENTER = 13,
      KEY_CODE_ESC = 27;

const EVENT_INPUT = 'input',
      EVENT_KEYUP = 'keyup',
      EVENT_KEY_ENTER = 'key-enter',
      EVENT_KEY_ESC = 'key-esc',
      EVENT_BLUR = 'blur',
      EVENT_FOCUS = 'focus';

/**
 * @constructor
 */
function DomInputWrapper(ele){
    if(!(this instanceof DomInputWrapper)){
        return new DomInputWrapper(ele);
    }

    ele = $(ele)[0];

    if(ele._domInputObject){
        return ele._domInputObject;
    }

    ele._domInputObject = this;

    this.ele = ele;
    this.handlers = {};
    this.errorHandler = function(){};
    this.state = {
        inputing: false,
        prevVal: $(ele).val()
    };
}

/**
 * @param {function} handler - the handler
 * @return {DomInputWrapper}
 */
DomInputWrapper.prototype.onError = function(handler){
    var self = this;

    if(typeof handler == 'function'){
        self.errorHandler = handler;
    }

    return self;
}

/**
 * @param {function} handler - the handler
 * @return {DomInputWrapper}
 */
DomInputWrapper.prototype.onBlur = function(handler, options){
    var self = this;

    registerEvent.call(self, EVENT_BLUR, handler, options, function(){
        var ele = self.ele;

        $(ele).on('focusout', function(event){
            var q = self.handlers[EVENT_BLUR],
                errHandler = self.errorHandler;

            fireHandlers.call(self, ele, EVENT_BLUR, errHandler, q, event);
        });
    });

    return self;
};

/**
 * @param {function} handler - the handler
 * @return {DomInputWrapper}
 */
DomInputWrapper.prototype.onFocus = function(handler, options){
    var self = this;

    registerEvent.call(self, EVENT_FOCUS, handler, options, function(){
        var ele = self.ele;

        $(ele).on('focus', function(event){
            var q = self.handlers[EVENT_FOCUS],
                errHandler = self.errorHandler;

            fireHandlers.call(self, ele, EVENT_FOCUS, errHandler, q, event);
        });
    });

    return self;
};

/**
 * @param {Number} keyCode - keyCode
 * @param {function} handler - the handler
 * @return {DomInputWrapper}
 */
DomInputWrapper.prototype.onKeyEvent = function(keyCode, handler, options){
    var self = this;

    if(!keyCode || !handler){
        return self;
    }

    registerEvent.call(self, EVENT_KEYUP, handler, $.extend({
        'subKey': 'keyCode',
        'subKeyValue': keyCode
    }, options || {}), function(){
        var ele = self.ele;

        $(ele).on('keyup', function(event){
            var code = event.keyCode,
                errHandler = self.errorHandler,
                o, m, q;
            
            m = self.handlers[EVENT_KEYUP];

            if(!m){
                return;
            }

            q = m[code];

            if(!q || !q.length){
                return;
            }

            fireHandlers.call(self, ele, EVENT_KEYUP, errHandler, q, event);
        });
    });

    return self;
}

/**
 * @param {function} handler - the handler
 * @return {DomInputWrapper}
 */
DomInputWrapper.prototype.onKeyEsc = function(handler, options){
    var self = this;
    
    self.onKeyEvent(KEY_CODE_ESC, handler, options);

    return self;
}

/**
 * @param {function} handler - the handler
 * @return {DomInputWrapper}
 */
DomInputWrapper.prototype.onKeyEnter = function(handler, options){
    var self = this;

    self.onKeyEvent(KEY_CODE_ENTER, handler, options);

    return self;
};

/**
 * @param {function} handler - the handler
 * @return {DomInputWrapper}
 */
DomInputWrapper.prototype.onInput = function(handler, options){
    options = options || {};

    var self = this;

    return registerEvent.call(self, EVENT_INPUT, handler, options, function(){
        var o = self,
            ele = self.ele;

        $(ele).on('compositionstart', function(){
            o.state.inputing = true;
        });

        $(ele).on('compositionend', function(){
            o.state.inputing = false;
        });

        $(ele).on('input change', function(event){
            if(o.state.inputing){
                return true;
            }

            var q = o.handlers[EVENT_INPUT],
                errHandler = o.errorHandler;

            fireHandlers.call(self, ele, EVENT_INPUT, errHandler, q, event);

            return true;
        });
    });
}

function registerEvent(eventName, handler, options, registerFunc){
    options = options || {};

    var self = this,
        o = self,
        subKey = options.subKey,
        subKeyValue = options.subKeyValue,
        k, cur, m, q, h, shouldAddEventListener;

    if(typeof handler != 'function'){
        return self;
    }

    shouldAddEventListener = !o.handlers[eventName];

    if(subKey){
        o.handlers[eventName] = m = o.handlers[eventName] || {};

        if(!subKeyValue){
            subKeyValue = '_default';
        }

        q = m[subKeyValue] = m[subKeyValue] || [];
    }else{
        q = o.handlers[eventName] = o.handlers[eventName] || [];
    }

    cur = q.filter(h => h.handler === handler);

    if(!cur.length){
        q.push({ 
            handler: handler, 
            validators: [].concat(options.validators).filter(Boolean),
            preFormatters: [].concat(options.preFormatters).filter(Boolean),
            postFormatters: [].concat(options.postFormatters).filter(Boolean)
        });
    }else{
        cur.forEach(function(h){
            options.validators.forEach(function(v){
                if(!h.validators.some(v1 => v1 === v)){
                    h.validators.push(v);
                }
            });
            options.preFormatters.forEach(function(f){
                if(!h.preFormatters.some(f1 => f1 === f)){
                    h.preFormatters.push(f);
                }
            });
            options.postFormatters.forEach(function(f){
                if(!h.postFormatters.some(f1 => f1 === f)){
                    h.postFormatters.push(f);
                }
            });
        });
    }

    if(shouldAddEventListener && typeof registerFunc == 'function'){
        registerFunc.call(self);
    }

    return self;
}

function fireHandlers(ele, eventName, errHandler, handlers, eventObject){
    if(!ele || !handlers || !handlers.length){
        return false;
    }

    var self = this,
        stopped;

    eventObject = eventObject || {};

    stopped = false;

    handlers.forEach(function(h){
        if(stopped){
            return;
        }

        var validators = h.validators,
            preFormatters = h.preFormatters,
            postFormatters = h.postFormatters,
            val, tmp, v, f, i, err;

        tmp = $(ele).val();

        if(preFormatters && preFormatters.length){
            for(i=0;i<preFormatters.length;i++){
                f = preFormatters[i];
                tmp = f(tmp);
            }
        }

        if(validators && validators.length){
            for(i=0;i<validators.length;i++){
                v = validators[i];
                err = v.call(self, tmp);

                if(typeof err == 'object' && err.error){
                    if(err.preventInput){
                        if(tmp != self.state.prevVal){
                            $(ele).val(self.state.prevVal || '');
                        }
                        err.inputPrevented = true;
                    }
                    if(errHandler){
                        errHandler.call(self, err);
                    }
                    if(err.stopPropagation){
                        stopped = true;
                        return;
                    }
                }
            }
        }

        if(err && err.inputPrevented){
            tmp = $(ele).val();
        }

        if(postFormatters && postFormatters.length){
            for(i=0;i<postFormatters.length;i++){
                f = postFormatters[i];
                tmp = f(tmp);
            }
        }

        val = tmp;

        eventObject.changed = (self.state.prevVal == val);

        if(eventObject.changed){
            $(ele).val(val);
        }

        h.handler && h.handler.call(self, eventObject);
    });

    self.state.prevVal = $(ele).val();

    return true;
}

module.exports = DomInputWrapper;