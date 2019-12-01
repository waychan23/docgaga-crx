"use strict";

function DocGagaRuntime(){
    this.env = null;
}

DocGagaRuntime.prototype.setEnv = function(env){
    if(!env){
        throw new Error("'env' must not be empty");
    }
    if(this.env){
        throw new Error("Runtime 'env' already set to: " + this.env);
    }
    this.env = env;
    return this;
}

DocGagaRuntime.prototype.requireEnv = function(){
    if(!this.env){
        throw new Error("Runtime 'env' not set")
    }
    return this.env;
}

module.exports = new DocGagaRuntime();