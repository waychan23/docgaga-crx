"use strict";

module.exports = DocGagaStore;

function DocGagaStore(){

}

DocGagaStore.prototype.save = function(obj){
	return callOrComplain.call(this, 'save', '_save', [obj]);
};

DocGagaStore.prototype.get = function(objPk){
	return callOrComplain.call(this, 'get', '_get', [objPk]);
};

DocGagaStore.prototype.list = function(pairs, searchAllPages, opts){
	return callOrComplain.call(this, 'list', '_list', [pairs, searchAllPages, opts]);
};

DocGagaStore.prototype.delete = function(objPk){
	return callOrComplain.call(this, 'delete', '_delete', [objPk]);
};

DocGagaStore.prototype.update = function(obj, objPk){
	return callOrComplain.call(this, 'update', '_update', [obj, objPk]);
};

DocGagaStore.prototype.listBy = function(pairs, searchAllPages, opts){
	return callOrComplain.call(this, 'listBy', '_listBy', [pairs || [], searchAllPages, opts]);
};

function callOrComplain(interf, methodName, args){
	if(typeof this[methodName] == 'function'){
		return this[methodName].apply(this, [].concat(args));
	}
	throw "Method '"+interf+"' not implemented!";
}
