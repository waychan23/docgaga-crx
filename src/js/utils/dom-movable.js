"use strict";

const $ = require('jquery'),
	  SimpleEventEmitter = require('../base/simple-event-emitter'),
	  selUtils = require('../utils/selection-utils');

const MOVABLE_DOM_CLASSNAME = "movable-dom-cfa056fc7428d713";
const MOVABLE_DRAGGED_DOM_CLASSNAME = "movable-dragged-dom-cfa056fc7428d713";

const TYPE_FIXED = "fixed";
const TYPE_ABSOLUTE = 'absolute';
const dragDistanceThreshold = 10;

const isDebug = false;

const movableObjectRegistry = {
	'initDone': false,
	'movables': [],
	'static': [],
	'dragging': [],
	'mousedown': []
};

function tempAddEventHandlers(){
	$(document.documentElement).on('mouseup mouseout', stopDraggingHandler);
	$(document.documentElement).on('mouseout', selUtils.clearAllSelection);
	$(document.documentElement).on('mousemove', dragHandler);
	$(document).on('mousemove', '.'+MOVABLE_DRAGGED_DOM_CLASSNAME, startDraggingHandler);
}

function tempRemoveEventHandlers(){
	$(document).off('mousemove', '.'+MOVABLE_DOM_CLASSNAME, startDraggingHandler);
	$(document.documentElement).off('mousemove', dragHandler);
	$(document.documentElement).off('mouseout', selUtils.clearAllSelection);
	$(document.documentElement).off('mouseup mouseout', stopDraggingHandler);
}

function createShadeLayer(){
	var registry = movableObjectRegistry;

	registry.shadeDom = $("<div></div>").css({
		'position': 'fixed',
		'width': $(window).innerWidth(),
		'height': $(window).innerHeight(),
		'left': 0,
		'top': 0,
		'zIndex': 100000000,
		'background': 'none',
		'opacity': 0,
		'visibility': 'hidden'
	});

	registry.shadeDom.appendTo($(document.body));

	return registry.shadeDom;
}

function updateShadeLayer(movable){
	if(!movable){
		return;
	}
	if(!movableObjectRegistry.shadeDom){
		createShadeLayer(movable);
	}
	var registry = movableObjectRegistry,
		shadeDom = registry.shadeDom,
		zIndex = parseInt($.css(movable.dom[0], 'zIndex', true)),
		curZIndex = parseInt($.css(shadeDom[0], 'zIndex', true));

	if(!zIndex){
		zIndex = -10000000;
	}

	curZIndex = zIndex - 1;

	shadeDom.css({
		'display': 'block',
		'width': $(window).innerWidth(),
		'height': $(window).innerHeight(),
		'zIndex': curZIndex
	});
}

movableObjectRegistry.init = function(){
	var self = movableObjectRegistry;
	
	$(document).on('mousedown', '.'+MOVABLE_DRAGGED_DOM_CLASSNAME, mouseDownHandler);

	debug('registry init: ', (self.initDone = true));
};

movableObjectRegistry.register = function(movable){
	if(!movable){
		throw "movable must be specified";
	}

	var self = movableObjectRegistry;
	
	if(self.movables.indexOf(movable) >= 0){
		return movable;
	}

	if(!whichType(movable)){
		console.warn('movable ignored by registry because of unsupported "position" type ');
		return null;
	}

	if(!self.initDone){
		self.init();
		return self.register(movable);
	}
	
	stopDragging(movable);

	self.movables.push(movable);
	self.static.push(movable);

	movable.opts.cursor && movable.draggedDom.css('cursor', movable.opts.cursor);
	movable.opts.inBoundry && (movable.avoidOutOfBoundry = avoidOutOfBoundry(movable));
	movable.enable = function(){
		movable.enabled = true;
	};

	movable.disable = function(){
		movable.enabled = false;
	};

	movable.stop = function(){
		stopDragging(movable);
	};

	movable.destroy = function(){
		movableObjectRegistry.unregister(movable);
	};

	movable.enable();

	debug('movable registered: ', movable);

	return movable;
};

movableObjectRegistry.unregister = function(movable){
	if(!movable){
		throw "movable must be specified";
	}

	var self = movableObjectRegistry;

	stopDragging(movable);

	if(!self.initDone){
		return movable;
	}

	[self.static, self.dragging, self.mousedown].forEach(function(arr){
		var index = arr.indexOf(movable);
		if(index >= 0){
			arr.splice(index, 1);
		}
	});

	removeFromArr(self.movables, movable);

	debug('movable unregistered: ', movable);

	return movable;
};

function removeFromArr(arr, obj){
	var index = arr.indexOf(obj);
	if(index >= 0){
		arr.splice(index, 1);
	}
}

function fromArrToArr(obj, from, to){
	var fromIndex = from.indexOf(obj),
		toIndex = to.indexOf(obj);

	if(fromIndex >= 0){
		from.splice(fromIndex, 1);
	}
	
	if(toIndex < 0){
		to.push(obj);
	}
}

function dragFarEnough(m, p){
	var sp = m.dragPoint,
		delta = getPointDelta(sp, p),
		thres = m.opts.dragDistanceThreshold;

	if(!thres || thres <= 0){
		return true;
	}
	
	return Math.pow(delta.offsetX, 2) + Math.pow(delta.offsetY, 2) >= (thres * thres);
}

function startDraggingHandler(event){
	var target = $(event.target).closest('.'+MOVABLE_DRAGGED_DOM_CLASSNAME)[0],
		movable = target._movableObject;

	(movable || []).map(function(m){
		return m.enabled && m || stopDragging(m) && false;
	}).filter(Boolean).forEach(function(m){
		if(m.mousedown && !m.dragging && dragFarEnough(m, getPoint(event))){
			m.mousedown = false;
			m.dragging = true;

			m.opts.transparent && m.dom.css('opacity', 0.5);

			fromArrToArr(m, movableObjectRegistry.mousedown, movableObjectRegistry.dragging);
			m.fireEvent('drag-start');
			debug('start dragging movable: ', m);
		}
	});
}
	

function stopDraggingHandler(event){
	stopDragging();
}

function stopDragging(movable){
	var registry = movableObjectRegistry;

	(movable && [movable] || movableObjectRegistry.dragging.concat(movableObjectRegistry.mousedown)).filter(Boolean).forEach(function(m){
		delete m.mousedown;
		delete m.dragging;
		delete m.dragPoint;

		fromArrToArr(m, movableObjectRegistry.dragging, movableObjectRegistry.static);
		fromArrToArr(m, movableObjectRegistry.mousedown, movableObjectRegistry.static);

		m.opts.transparent && m.dom.css('opacity', 1);

		m.fireEvent('drag-end');
		debug('stop movable: ', m);
	});

	if(registry.mousedown.length + registry.dragging.length <= 0){
		tempRemoveEventHandlers();
		registry.shadeDom && registry.shadeDom.css('display', 'none');
	}
}

function mouseDownHandler(event){
	var target = $(event.target).closest('.'+MOVABLE_DRAGGED_DOM_CLASSNAME)[0],
		movable = target._movableObject,
		registry = movableObjectRegistry;
	
	(movable || []).filter(m => m.enabled).forEach(function(m){
		delete m.dragging;
		m.mousedown = true;
		m.dragPoint = getPoint(event);
		fromArrToArr(m, registry.static, registry.mousedown);

		updateShadeLayer(m);
		debug('mouse down movable: ', movable);
	});

	if(registry.mousedown.length){
		tempAddEventHandlers();
	}
}

function dragHandler(event){
	var registry = movableObjectRegistry,
		curPoint = getPoint(event);

	registry.dragging.map(function(m){
		return m.enabled && m || stopDragging(m) && false;
	}).filter(Boolean).forEach(function(m){
		moveTo(m, curPoint);
		m.dragPoint = curPoint;
	});
}

function curPosition(movable){
	var offset = movable.dom.offset(),
		pos = {};

	pos.left = offset.left;
	pos.top = offset.top;

	computeRightBottom(movable, pos);

	return pos;
}

function computeRightBottom(movable, pos){
	var scrollOffset = { 'left': $('html').scrollLeft() || $(document.body).scrollLeft(), 'top': $('html').scrollTop() || $(document.body).scrollTop() },
		padding = getDomPadding(movable.dom),
		border = getDomBorderWidth(movable.dom),
		domDimens = { 'w': movable.dom.width() + padding.left + padding.right + border.left + border.right, 'h': movable.dom.height() + padding.top + padding.bottom + border.top + border.bottom },
		containerDom, contDimens, contOffset, contPadding, contBorder;

	if(movable.type == TYPE_FIXED){//pos.right is relative to the offsetParent
		containerDom = $(window),
		contDimens = { 'w': containerDom.innerWidth(), 'h': containerDom.innerHeight() };
		pos.right = contDimens.w - (domDimens.w - (scrollOffset.left - pos.left));
		pos.bottom = contDimens.h -(domDimens.h - (scrollOffset.top - pos.top));
	}else if(movable.type == TYPE_ABSOLUTE){//pos.bottom is relative to the offsetParent
		containerDom = movable.containerDom;
		contPadding = getDomPadding(containerDom);
		contBorder = getDomBorderWidth(containerDom);
		contDimens = { 'w': containerDom.width() + contPadding.left + contPadding.right, 'h': containerDom.height() + contPadding.top + contPadding.bottom };
		contOffset = containerDom.offset();
		pos.right = contDimens.w - (pos.left - contBorder.left - contOffset.left) - domDimens.w;
		pos.bottom = contDimens.h - (pos.top - contBorder.top - contOffset.top) - domDimens.h;
	} 

	return pos;
}

function newPosition(movable, toDragPoint){
	var pos = movable.dom.offset(),
		delta = getPointDelta(movable.dragPoint, toDragPoint),
		newPos = {
			'left': pos.left + delta.pageX,
			'top': pos.top + delta.pageY
		};

	return movable.avoidOutOfBoundry && movable.avoidOutOfBoundry(newPos) || computeRightBottom(movable, newPos);
}

function moveTo(movable, toDragPoint){
	if(!movable || !toDragPoint){
		return;
	}

	var newPos = newPosition(movable, toDragPoint),
		nPos = {}, useRightBottom = 2;

//	debug(JSON.stringify(pos)+" => "+JSON.stringify(newPos));

	
	movable.dom.offset(newPos);
	nPos.right = newPos.right;
	nPos.bottom = newPos.bottom;
	if(!movable.opts.useRight){
		delete nPos.right;
		useRightBottom --;
	}else{
		nPos.left = '';
	}
	if(!movable.opts.useBottom){
		delete nPos.bottom;
		useRightBottom --;
	}else{
		nPos.top = '';
	}
	
	useRightBottom > 0 && movable.dom.css(nPos);
}

function getPointDelta(from, to){
	return {
		'offsetX': to.offsetX - from.offsetX,
		'offsetY': to.offsetY - from.offsetY,
		'screenX': to.screenX - from.screenX,
		'screenY': to.screenY - from.screenY,
		'pageX': to.pageX - from.pageX,
		'pageY': to.pageY - from.pageY
	};
}

function getPoint(event){
	return {
		'offsetX': event.offsetX,
		'offsetY': event.offsetY,
		'screenX': event.screenX,
		'screenY': event.screenY,
		'pageX': event.pageX,
		'pageY': event.pageY
	};
}

function whichType(m){
	if(!m || !m.dom){
		return null;
	}
	var position = $(m.dom).css('position'),
		containerDom;

	if(position == TYPE_FIXED){
		m.type = TYPE_FIXED;
	}else if(position == TYPE_ABSOLUTE){
		m.type = TYPE_ABSOLUTE;
		containerDom = m.dom.offsetParent();
		if(containerDom[0]){
			if(/HTML/i.test(containerDom[0].nodeName)){
				m.containerDom = $(document.documentElement);
			}else{
				m.containerDom = $(containerDom[0]);
			}
		}
	}

	return m.type || null;
}

module.exports.makeMovable = function(dom, draggedDom, opts){
	opts = opts || {};

	opts.dragDistanceThreshold = !isNaN(Math.floor(opts.dragDistanceThreshold))?Math.floor(opts.dragDistanceThreshold): dragDistanceThreshold;

	var movable = Object.create(new SimpleEventEmitter());

	if(!dom){
		throw "No DOM specified";
	}

	dom = $(dom);
	draggedDom = draggedDom && $(draggedDom) || dom;
	
	dom[0]._movableObject = movable;
	draggedDom[0]._movableObject = [].concat(draggedDom._movableObject).concat(movable).filter(Boolean);

	movable.dom = dom.addClass(MOVABLE_DOM_CLASSNAME);
	movable.draggedDom = draggedDom.addClass(MOVABLE_DRAGGED_DOM_CLASSNAME);
	movable.opts = opts;

	return movableObjectRegistry.register(movable);
};

function debug(){
	var args = [], i;
	for(i=0;i<arguments.length;i++){
		args.push(arguments[i]);
	}
	isDebug && console.log(args, 'registry: ', movableObjectRegistry);
}

function getDomBorderWidth(dom){
	if(!dom){
		return {
			'left': 0, 'right': 0, 'top': 0, 'bottom': 0
		};
	}
	return {
		'left': $.css($(dom)[0], 'borderLeftWidth', true) || 0,
		'top': $.css($(dom)[0], 'borderTopWidth', true) || 0,
		'right': $.css($(dom)[0], 'borderRightWidth', true) || 0,
		'bottom': $.css($(dom)[0], 'borderBottomWidth', true) || 0
	};
}

function getDomPadding(dom){
	if(!dom){
		return {
			'left': 0, 'right': 0, 'top': 0, 'bottom': 0
		};
	}
	return {
		'left': $.css($(dom)[0], 'paddingLeft', true) || 0,
		'top': $.css($(dom)[0], 'paddingTop', true) || 0,
		'right': $.css($(dom)[0], 'paddingRight', true) || 0,
		'bottom': $.css($(dom)[0], 'paddingBottom', true) || 0
	};
}

function avoidOutOfBoundry(movable){
	if(!movable || [TYPE_FIXED, TYPE_ABSOLUTE].indexOf(movable.type) < 0 || !movable.opts.inBoundry){
		return function(offset){ return offset; };
	}

	function getBoundry(){
		var boundry, containerDom, contOffset, contDimens, padding, border,
			p = movable.opts.containPadding,
			dom = movable.dom;

		if(movable.type == TYPE_FIXED){
			containerDom = $(window);
			boundry = {
				'xmin': 0,
				'ymin': 0,
				'xmax': 0 + containerDom.innerWidth(),
				'ymax': 0 + containerDom.innerHeight()
			};
		}else{
			containerDom = movable.containerDom;
			contOffset = containerDom.offset();
			contDimens = {
				'w': containerDom.width(),
				'h': containerDom.height()
			};
			padding = getDomPadding(containerDom);
			border = getDomBorderWidth(containerDom);
			boundry = {
				'xmin': ((p?(contOffset.left):(contOffset.left + padding.left)) + border.left) || 0,
				'ymin': ((p?(contOffset.top):(contOffset.top + padding.top)) + border.top) || 0,
				'xmax': ((p?(contOffset.left + padding.left + contDimens.w + padding.right):(contOffset.left + padding.left + contDimens.w)) + border.left)|| $(window).innerWidth(),
				'ymax': ((p?(contOffset.top + padding.top + contDimens.h + padding.bottom):(contOffset.top + padding.top + contDimens.h)) + border.top) || $(window).innerHeight()
			};
		}
		return boundry;
	}

	return movable.type == TYPE_FIXED?function(offset){
		var padding = getDomPadding(movable.dom),
			domDimens = { 'w': movable.dom.width() + padding.left + padding.right, 'h': movable.dom.height() + padding.top + padding.bottom},
			scrollTop = $('html').scrollTop() || $(document.body).scrollTop(),
			scrollLeft = $('html').scrollLeft() || $(document.body).scrollLeft(),
			boundry = getBoundry(),
			newOffset = {};

		newOffset.left = offset.left - scrollLeft < boundry.xmin? boundry.xmin + scrollLeft: ( offset.left - scrollLeft + domDimens.w > boundry.xmax? boundry.xmax + scrollLeft - domDimens.w: offset.left );

		newOffset.top = offset.top - scrollTop < boundry.ymin? boundry.ymin + scrollTop: ( offset.top - scrollTop + domDimens.h > boundry.ymax? boundry.ymax + scrollTop - domDimens.h: offset.top );

		return computeRightBottom(movable, newOffset);
	}:function(offset){
		var padding = getDomPadding(movable.dom),
			border = getDomBorderWidth(movable.dom),
			domDimens = { 'w': movable.dom.width() + padding.left + padding.right, 'h': movable.dom.height() + padding.top + padding.bottom },
			boundry = getBoundry(),
			newOffset = {};

		newOffset.left = offset.left < boundry.xmin? boundry.xmin: ( offset.left + domDimens.w > boundry.xmax? boundry.xmax - domDimens.w: offset.left );
		newOffset.top = offset.top < boundry.ymin? boundry.ymin: ( offset.top + domDimens.h > boundry.ymax? boundry.ymax - domDimens.h: offset.top );

		return computeRightBottom(movable, newOffset);
	};
}
