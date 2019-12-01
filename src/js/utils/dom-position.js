"use strict";

var $ = require('jquery');

module.exports = {
	'avoidOutOfClient': avoidOutOfClient,
	'getDomOffsetTopToDocument': getDomOffsetTopToDocument
};

function getDomOffsetTopToDocument(dom){
	dom = $(dom)[0];

	var sum = 0,
		jq, offsetParent, offsetTop;

//	if(dom === document || dom.nodeName == 'HTML' || dom.nodeName == 'BODY'){
	if(dom === document || dom.nodeName == 'HTML'){
		return 0;
	}
	
	if(!dom.offsetTop){
		jq = true;
	}

	offsetParent = op(dom, jq);

	while(offsetParent && offsetParent !== document){
		sum += ot(dom, jq);
//		if(offsetParent === document || offsetParent.nodeName == 'HTML' || offsetParent.nodeName == 'BODY'){
		dom = offsetParent;
		offsetParent = op(dom, jq);
	}

	if(!offsetParent){
		if($(dom).css('display') != 'none'){
			return sum;
		}
		return null;
	}

	function ot(dom, jq){
		return jq? $(dom).position().top: $(dom)[0].offsetTop;
	}

	function op(dom, jq){
		if($(dom)[0].nodeName == 'HTML'){
			return null;
		}
		return jq? $(dom).offsetParent()[0]: $(dom)[0].offsetParent;
	}

	return sum;
}

function getDomPadding(dom){
	dom = $(dom)[0];

	return {
		'left': $.css(dom, 'paddingLeft', true),
		'right': $.css(dom, 'paddingRight', true),
		'top': $.css(dom, 'paddingTop', true),
		'bottom': $.css(dom, 'paddingBottom', true)
	};
}

function getDomBorderWidth(dom){
	dom = $(dom)[0];
	
	return {
		'left': $.css(dom, 'borderLeftWidth', true),
		'right': $.css(dom, 'borderRightWidth', true),
		'top': $.css(dom, 'borderTopWidth', true),
		'bottom': $.css(dom, 'borderBottomWidth', true)
	};
}

function avoidOutOfClient(dom, pos, opts){
	pos = pos || {};
	opts = opts || {};
	
	dom = $(dom);

	var padding = getDomPadding(dom),
		border = getDomBorderWidth(dom),
		domDimens = { 'w': dom.width() +  border.left + border.right + padding.left + padding.right, 'h': dom.height() + border.top + border.bottom + padding.top + padding.bottom },
		clientDimens = { 'w': $(window).outerWidth(), 'h': $(window).outerHeight() },
		pageScroll = { 'left': $('html').scrollLeft() || $(document.body).scrollLeft(), 'top': $('html').scrollTop() || $(document.body).scrollTop()},
		offset = { 'left': parseInt(opts.offsetX) || 0, 'top': parseInt(opts.offsetY) || 0 },
		newPos;

	newPos = {
		'clientX': (parseInt(pos.clientX) || 0) + offset.left,
		'clientY': (parseInt(pos.clientY) || 0) + offset.top,
		'pageX': (parseInt(pos.pageX) || parseInt(pos.clientX) || 0) + offset.left,
		'pageY': (parseInt(pos.pageY) || parseInt(pos.clientY) || 0) + offset.top
	};

	newPos.clientX = newPos.clientX < 0? 0: (newPos.clientX + domDimens.w > clientDimens.w?clientDimens.w - domDimens.w: newPos.clientX);

	newPos.clientY = newPos.clientY < 0? 0: (newPos.clientY + domDimens.h > clientDimens.h?(newPos.clientY - domDimens.h - offset.top < 0? 0: newPos.clientY - domDimens.h - offset.top): newPos.clientY);

	newPos.pageX = pageScroll.left + newPos.clientX;
	
	newPos.pageY = pageScroll.top + newPos.clientY;

	return newPos;
}
