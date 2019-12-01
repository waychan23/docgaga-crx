"use strict";

const $ = require('jquery'),
	domUtils = require('./dom-position');

const CHAR_STARTING_PUNCT = [ ":", "#", "*", "：" ];
const CHAR_ENDING_PUNCT = [ ".", ";", "!", "?", "...", "......", "。", "；", "！", "？" ];
const CHAR_EMBRACE_START = [ "`", "'", "\"", "（", "[", "{", "<", "(", "“", "‘", "【", "『", "《", "/" ];
const CHAR_EMBRACE_END = [ "`", "'", "\"", ")", "]", "}", ">", "）", "”", "’", "】", "』", "》", "/" ];

module.exports = {
	'parseSelectionForText' : parseSelectionForText,
	'parseRangeForText': parseRangeForText,
	'parseNodeForText': parseNodeForText,
	'getCurrentParagraph': getCurrentParagraph,
	'copySelection': copySelection,
	'selectNode': selectNode,
	'selectRange': selectRange,
	'extendRange': extendRange,
	'locateRange': locateRange,
	'clearAllSelection': clearAllSelection,
	'locateByText': locateByText
};

function locateByText(text, filter, spliter, decide){
	text = text || '';

	if(!text){
		return null;
	}

	var parts, part, result, found, reset, matches,
		curLevel, tailLevel, prevLevel, level,
		partLen, prev, cur, paths, path, i, sr, er, regex;

	if(typeof spliter == 'function'){
		parts = spliter(text);
		if(!Array.isArray(parts)){
			throw "spliter should return an array";
		}
		parts = parts.reverse();
	}else{
		parts = text.split(/[\n\.\?,;!。？，；！]+/g);

		if(text.length >= 45 && parts.length < 3){
			parts = [];
			prev = 0;
			partLen = Math.ceil(text.length / 3);
			while(prev < text.length){
				if(prev + partLen >= text.length){
					parts.push(text.substring(prev, text.length));
					break;
				}
				i = text.indexOf(' ', prev + partLen);
				if(i < 0){
					i = text.indexOf('\n', prev + partLen);
				}
				if(i < 0){
					parts.push(text.substring(prev, prev + partLen));
					prev = part + partLen + 1;
				}else{
					parts.push(text.substring(prev, i));
					prev = i + 1;
				}
			}
		}

		parts = parts.map(function(part){
			return part.trim();
		}).filter(Boolean).reverse();
	}

	result = { levels: [] };
	prevLevel = null;
	prev = null;
	level = 0;

	while(parts.length){
		part = parts.pop();
		curLevel = { part: part, matches: [], index: level++ };

		if(!prevLevel || !prevLevel.matches.length){
			if(tailLevel){
				for(i=0;i<tailLevel.matches.length;i++){
					prev = tailLevel.matches[i];

					selectRange(prev.range);
					
					found = window.find(part);

					if(found && (typeof filter != 'function' || filter(window.getSelection()))){
						prev.next = { range: copySelection(window.getSelection()).getRangeAt(0), level: curLevel, prev: prev };
						curLevel.matches.push(prev.next);
					}
				}
			}else{
				//reset the cursor to the end of the document
				window.find('__O0oO0d_aCcdocgagasxXSbDd5__o_1cDOCGAGA5_Dg_^-_-^G_4_a1_g_==_))--a**__');

				while(found = window.find(part, false, true)){
					if(typeof filter == 'function' && !filter(window.getSelection())){
						continue;
					}

					curLevel.matches.push({ range: copySelection(window.getSelection()).getRangeAt(0), level: curLevel });
				}
			}

		}else{
			for(i=0;i<prevLevel.matches.length;i++){
				prev = prevLevel.matches[i];

				selectRange(prev.range);

				found = window.find(part);

				if(found && (typeof filter != 'function' || filter(window.getSelection()))){
					prev.next = { range: copySelection(window.getSelection()).getRangeAt(0), level: curLevel, prev: prev };
					curLevel.matches.push(prev.next);
				}
			}
		}

		prevLevel = curLevel;
		curLevel.prevLevel = prevLevel;
		prevLevel.nextLevel = curLevel;

		result.levels.push(curLevel);

		if(curLevel.matches.length && tailLevel != curLevel){
			tailLevel = curLevel;
		}
	}

	paths = [];

	if(tailLevel){
		for(i=0;i<tailLevel.matches.length;i++){
			path = { length: 1 };
			cur = tailLevel.matches[i];
			sr = cur.range;
			er = cur.range;
			path.startLevel = cur.level.index;
			path.endLevel = cur.level.index;
			while(cur.prev){
				sr = cur.prev.range;
				path.startLevel = cur.prev.level.index;
				path.length += 1;		
				cur = cur.prev;
			}
			path.range = document.createRange();
			path.range.setStart(sr.startContainer, sr.startOffset);
			path.range.setEnd(er.endContainer, er.endOffset);
			path.matching = (path.length / result.levels.length).toFixed(2);
			paths.push(path);
		}
	}

	result.paths = paths;

	if(result.paths.length){
		if(typeof decide == 'function'){
			path = decide(paths);
			if(path && !(path.range instanceof Range)){
				throw "'decide' should return a path with a range";
			}
		}else{
			paths = paths.sort(function(a, b){
				if(b.length == a.length){
					return Math.abs(a.endLevel - a.startLevel) - Math.abs(b.endLevel - b.startLevel);
				}
				return b.length - a.length;
			});
			path = paths[0];
		}
	}

	clearAllSelection();
	
	return path || null;
}

function findPrevNotText(node){
	if(!node || !(node = $(node)[0])){
		return null;
	}
	while(node.previousElementSibling && /^b|big|small|tt|abbr|acronym|cite|code|dfn|em|kbd|strong|samp|a|bdo|img|q|span|sub|sup|button|input|label|select$/i.test(node.previousElementSibling.nodeName)){
		node = node.previousElementSibling;
	}
	return node.previousElementSibling || null;
}

function findNextNotText(node){
	if(!node || !(node = $(node)[0])){
		return null;
	}
	while(node.nextElementSibling && /^b|big|small|tt|abbr|acronym|cite|code|dfn|em|kbd|strong|samp|a|bdo|img|q|span|sub|sup|button|input|label|select$/i.test(node.nextElementSibling.nodeName)){
		node = node.nextElementSibling;
	}
	return node.nextElementSibling || null;
}

function locateRange(range){
	if(!range){
		return null;
	}

	var sNode = range.startContainer,
		eNode = range.endContainer,
		pos = {};

	if(sNode.nodeName == '#text'){
//		sNode = findPrevNotText(sNode) || sNode.parentNode;
		sNode = sNode.previousElementSibling || sNode.parentNode;
	}

	if(eNode.nodeName == '#text'){
//		eNode = findNextNotText(eNode) || eNode.parentNode;
		eNode = sNode.nextElementSibling || eNode.parentNode;
	}

	if(!sNode){
		return null;
	}

	pos.topY = $(sNode).offset().top;

	pos.scrollHeight = 160;
	
//	document.body.scrollTop = pos.topY - pos.scrollHeight;
	scrollToPosition(sNode, 100);

	if(eNode){
		pos.bottomY = $(eNode).offset().top + eNode.offsetHeight;
		pos.leftX = Math.min($(sNode).offset().left, $(eNode).offset().left);
		pos.rightX = Math.max($(sNode).offset().left + sNode.offsetWidth, $(eNode).offset().left + eNode.offsetWidth);
	}else{
		pos.bottomY = pos.topY + sNode.offsetHeight;
		pos.leftX = $(sNode).offset().left;
		pos.rightX = $(sNode).offset().left + sNode.offsetWidth;
	}

	pos.clientTop = document.body.scrollTop;
	pos.clientLeft = document.body.scrollLeft;

	return pos;
}

function scrollToPosition(target, containerScrollTop){
	var container, scrollable, nodeName, dist,
		targetTop, containerTop;

	container = findNearestScrollableContainer(target);

	if(!container){
		return;
	}

	targetTop = domUtils.getDomOffsetTopToDocument(target);
	containerTop = domUtils.getDomOffsetTopToDocument(container);

	if(targetTop == null || containerTop == null){
		return;
	}

	dist = targetTop - containerTop - containerScrollTop;

	if(dist < 0){
		dist = 0;
	}

	$(container).scrollTop(dist);

	if(/^(HTML|BODY)$/i.test(container[0].nodeName)){
		return;
	}else{
		scrollToPosition(container, 0);
	}
}

function findNearestScrollableContainer(dom){
	var container, s;

	container = $(dom).parent();

	while(container){
		s = isScrollable(container);
		if(s == null){
			return null;
		}
		if(!s){
			container = container.parent();
		}else{
			return container;
		}
	}

	return null;

	function isScrollable(container){
		var nodeName = (container && container.length && container[0].nodeName),
			scrollable, tmp, y1, y2, y2;
		if(!nodeName){
			return null;
//		}else if(nodeName == 'HTML' || container[0] === document){
		}else if(container[0] === document){
			return false;
		}else if(container.css('overflow-y') != 'hidden' && container.css('display') != 'none'){
			container = $(container)[0];
			tmp = container.scrollTop;
			container.scrollTop = tmp + 1;
			y1 = container.scrollTop;
			container.scrollTop = tmp - 1;
			y2 = container.scrollTop;
			return tmp != y1 || tmp != y2;
		}

		return false;
	}
}

function clearAllSelection(){
	var selection = window.getSelection();
	if(selection.rangeCount > 0){
		selection.removeAllRanges();
	}
}

function selectRange(range){
	if(!(range instanceof Range)){
		return range;
	}
	var selection = window.getSelection();
	if(selection.rangeCount > 0){
		selection.removeAllRanges();
	}
	selection.addRange(range);
	return range;
}

function selectNode(node){
	var range = getNodeTextRange(node);
	return selectRange(range);
}

function getNodeTextRange(node){
	if(!node){
		return null;
	}
	var range = document.createRange();
	range.selectNode(node);

	return range;
}

function getCurrentParagraph(selection, startOrEnd, testCond){
	if(!selection || !selection.rangeCount){
		return '';
	}

	startOrEnd = startOrEnd || 'start';

	startOrEnd = ['start', 'end'].indexOf(startOrEnd) != -1? startOrEnd: 'start';

	return getClosest(selection.getRangeAt(0)[startOrEnd+'Container'], testCond || /^(p|h\d+|section|code|div|dd|td|th|form|input|textarea|li|header|footer)$/i);
}

function textFormatter(text){
	text = text || '';
	return text.replace(/^\s+|\s+$/g, '');
}

function parseRangeForText(range, formatText){
	if(!range || range.collapsed){
		return '';
	}

	var sNode = range.startContainer,
		eNode = range.endContainer,
		sOffset = range.startOffset,
		eOffset = range.endOffset,
		text = walk({ 'node': sNode, 'offset': sOffset }, { 'node': eNode, 'offset': eOffset }, range.commonAncestorContainer) || '';

	return formatText?textFormatter.apply(null, [text]):text;
}

function parseSelectionForText(selection, formatText){
    if(!selection || selection.isCollapsed || !selection.rangeCount){
		return '';
    }

	return parseRangeForText(selection.getRangeAt(0), formatText);
}

function parseNodeForText(node, formatText){
	var text = node?(node.innerText || ''):'';
	return formatText?textFormatter.apply(null, [text]):text;
}

function walk(from, to, root){
	if(!from || !to){
		return '';
	}

	root = root || document.body;
	
	var node = from.node, text, next;

	if(node.nodeName == '#text'){
		if(node !== to.node){
			next = nextNode(node, root);
		}

		text = node.nodeValue.substring(from.offset, node === to.node?(to.offset>=0?to.offset:node.nodeValue.length):node.nodeValue.length);

		return text + (next?walk({ 'node': next, 'offset': 0 }, to, root):'');
	}else if(from.node !== to.node){
		node = nextNode(node, root);

		return node?walk({ 'node': node, 'offset': 0 }, to, root):'';
	}

	return '';
}

function nextNode(node, root){
	var next = (node.nodeName == "#text"?null:node.firstChild) || node.nextSibling;

	while(!next && (node = node.parentNode) && (node !== root)){
		if(node.nextSibling){
			next = node.nextSibling;
			break;
		}
	}

	return next;
}

function getClosest(cur, nodeName, util){
	var node;
	while(cur && nodeName){
		if(typeof nodeName == 'function'){
			node = nodeName.call(cur, cur)?cur:node;
		}else if(typeof nodeName.test == 'function'){
			node = nodeName.test(cur.nodeName)?cur:node;
		}else if(typeof nodeName == 'string'){
			node = (cur.nodeName.toLowerCase() == nodeName.toLowerCase())?cur:node;
		}else{
			break;
		}
		if(node || cur === util){
			break;
		}
		cur = cur.parentNode;
	}
	return node || null;
}

function copySelection(selection){
	if(!selection){
		return null;
	}
	var sel = {};

	sel.anchorNode = selection.anchorNode;
	sel.anchorOffset = selection.anchorOffset;
	sel.focusOffset = selection.focusOffset;
	sel.focusNode = selection.focusNode;
	sel.rangeCount = selection.rangeCount;
	sel.isCollapsed = selection.isCollapsed;
	sel.type = selection.type;
	sel._ranges = (function() {
		var i, ranges = [];

		for(i=0;i<selection.rangeCount;i++){
			ranges.push(selection.getRangeAt(i));
		}

		return ranges;
	})();
	sel.getRangeAt = function(index){
		return sel._ranges[index];
	};

	return sel;
}

function extendRange(oldRange, testStart, testEnd){
	if(!oldRange){
		return null;
	}

	testStart = testStart || backwardTest;
	testEnd = testEnd || forwardTest;

	var newRange = null,
		start, end;

	start = extendNodeBackward(oldRange.startContainer, oldRange.startOffset, testStart);
	end = extendNodeForward(oldRange.endContainer, oldRange.endOffset, testEnd);

	if(!start || !end){
		return null;
	}

	newRange = document.createRange();
	newRange.setStart(start.node, start.offset);
	newRange.setEnd(end.node, end.offset);
	
	return newRange;
}

function backwardTest(node, offset){
	if(!node || node.nodeName != '#text'){
		return false;
	}
	var matches = ['.', '?', '!', '。', '？', '！', '...', '......', ';', '；', ':', '：', '|', '/*', '//', "(", "（", ")", "）", "\"", "'", "“"],
		str = node.nodeValue.substr(0, offset + 1),
		found, i, idx;

	for(i=0;i<matches.length;i++){
		if((idx = str.lastIndexOf(matches[i])) != -1 && testSpecialCases(str, matches[i], idx) && (!found || found.offset < idx)){
			found = found || {};
			found.node = node;
			found.offset = idx + matches[i].length;
			found.meet = matches[i];
		}
	}

	function testSpecialCases(str, punct, index){
		if(['.', '?', '!'].indexOf(punct) != -1){
			if(index > 0 && /[A-z0-9_\$]/.test(str.charAt(index - 1)) && /[A-z0-9_\$]/.test(str.charAt(index + 1))){
				return false;
			}
		}
		return true;
	}

	return found || false;
}

function forwardTest(node, offset){
	if(!node || node.nodeName != '#text'){
		return false;
	}
	var matches = ['.', '?', '!', '。', '？', '！', '...', '......', ';', '；', '|', '*/', '(', '（', ')', '）', "\"", "'", "”"],
		str = node.nodeValue.substr(offset),
		found, i, idx;

	for(i=0;i<matches.length;i++){
		if((idx = str.indexOf(matches[i])) != -1 && testSpecialCases(str, matches[i], idx) && (!found || found.offset > idx)){
			found = found || {};
			found.node = node;
			found.offset = offset + idx + matches[i].length;
			found.meet = matches[i];
		}
	}

	function testSpecialCases(str, punct, index){
		if(['.', '?', '!'].indexOf(punct) != -1){
			if(index > 0 && /[A-z0-9_\$]/.test(str.charAt(index - 1)) && /[A-z0-9_\$]/.test(str.charAt(index + 1))){
				return false;
			}
		}
		return true;
	}

	return found || false;
}

function extendNodeBackward(node, offset, test){
	if(!node || !test){
		return null;
	}
	var found = null,
		init = true,
		cur, lastTextNode;

	cur = node;

	outter: while(cur){
		if(/^(p|section|code|li|div|br|dt|dd|td|th|h\d+)$/i.test(cur.nodeName)){
			break outter;
		}
		if(cur.nodeName == '#text'){
			if(init && (!offset || offset < 0 || offset > cur.nodeValue.length - 1)){
				offset = 0;
			}else if(!init){
				offset = cur.nodeValue.length - 1;
			}
			lastTextNode = lastTextNode || {};
			lastTextNode.node = cur;
			found = backwardTest(cur, offset);
			if(found){
				break;
			}
		}
		if(!init && cur.lastChild){
			cur = cur.lastChild;
		}else if(cur.previousSibling){
			cur = cur.previousSibling;
		}else{
			while(cur.parentNode){
				if(/^(body|p|section|li|div|code|dt|dd|td|th|h\d+|document)$/i.test(cur.parentNode.nodeName)){
					break outter;
				}
				cur = cur.parentNode;
				if(cur.previousSibling){
					cur = cur.previousSibling;
					continue outter;
				}
			}
			break outter;
		}

		init = false;
	}

	if(!found && lastTextNode){
		found = lastTextNode;
		found.offset = 0;
	}

	return found || null;
}

function extendNodeForward(node, offset, test){
	if(!node || !test){
		return null;
	}
	var found = null,
		init = true,
		cur, lastTextNode;

	cur = node;

	outter: while(cur){
		if(/^(p|section|div|br|li|dt|dd|td|th|h\d+|b)$/i.test(cur.nodeName)){
			break outter;
		}
		if(cur.nodeName == '#text'){
			if(init && (!offset || offset < 0 || offset > cur.nodeValue.length - 1)){
				offset = cur.nodeValue.length - 1;
			}else if(!init){
				offset = 0;
			}
			lastTextNode = lastTextNode || {};
			lastTextNode.node = cur;
			found = forwardTest(cur, offset);
			if(found){
				break;
			}
		}

		if(!init && cur.firstChild){
			cur = cur.firstChild;
		}else if(cur.nextSibling){
			cur = cur.nextSibling;
		}else{
			while(cur.parentNode){
				if(/^(body|p|section|li|div|dt|dd|td|th|h\d+|b|document)$/i.test(cur.parentNode.nodeName)){
					break outter;
				}
				cur = cur.parentNode;
				if(cur.nextSibling){
					cur = cur.nextSibling;
					continue outter;
				}
			}
			break outter;
		}

		init = false;
	}

	if(!found && lastTextNode){
		found = lastTextNode;
		found.offset = found.node.nodeValue.length;
	}

	return found || null;
}
