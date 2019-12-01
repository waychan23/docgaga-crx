"use strict";

var selectionUtils = require('../utils/selection-utils');
var SimpleEventEmitter = require('../base/simple-event-emitter');

module.exports = ContentSelector;

function ContentSelector(){
	var self = this;

	SimpleEventEmitter.call(self);

	self.selectHandler = selectHandler;
	self.getSelection = getSelection;
	self.clear = clear;

	self.bootstrap = function(){
		return true;
	};

	self.destroy = function(){
		this.clearHandlers();
		return true;
	};
};

ContentSelector.prototype = Object.create(SimpleEventEmitter.prototype);

function selectHandler(event){
	var newSelection = parseSelection(selectionUtils.copySelection(window.getSelection()));

	if(newSelection && validateSelection(newSelection, this._prevSelection)){
		this._prevSelection = this._curSelection = newSelection;
		this.fireEvent('selectText',{ 'selection': this._curSelection });
		selectionUtils.selectRange(this._curSelection.selection.getRangeAt(0));
	}else{
		this._prevSelection = null;
	}


    function parseSelection(selection){
		if(!selection || !selection.rangeCount  || selection.isCollapsed){
            return null; 
		}

		var text = selectionUtils.parseSelectionForText(selection);
		
		return {
			'selection': selection,
			'selectedText': filterText(text || ''), 
            'position': {
				'x': event.pageX,
				'y': event.pageY,
				'clientX': event.clientX,
				'clientY': event.clientY,
				'pageX': event.pageX,
				'pageY': event.pageY
            } 
		};
    }

	function filterText(oriText){
		oriText = (oriText || '').replace(/^\s+|\s+$/g, '').replace(/\s+|\n+|(\r\n)+/g, ' ');
		return oriText;
	}
};

function getSelection(){
    return this._prevSelection; 
};

function clear(){
    this._curSelection = null; 
};


function validateSelection(newSelection, curSelection){
	var text;

	if(!newSelection ||
	   !(text = newSelection.selectedText) ||
	   text.length <= 0 || 
	   onlyPunct(text) ||
	   (curSelection && curSelection.selectedText == text)){
		return false;
	}

	function onlyPunct(text){
		return /^[~`!@#\$%\^&\*\(\)\-_\+=\{\}\[\]\|\\:;"'<,>\.\/（）【】、：；“‘，。？\s]*$/.test(text);
	}

	return true;
}
