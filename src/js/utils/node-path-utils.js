"use strict";

const $ = require('jquery');

module.exports.toNode = toNode;
module.exports.toPath = toPath;
module.exports.toRange = toRange;

function toRange(startPath, startOffset, endPath, endOffset){
	try{
		var sNode = toNode(startPath),
			eNode = toNode(endPath),
			sOffset, eOffset, range;

		if(!sNode || !eNode){
			return null;
		}

		range = document.createRange();

		sOffset = parseInt(startOffset) || (sNode.nodeName == '#text'?0:0);
		eOffset = parseInt(endOffset) || (eNode.nodeName == '#text'?(eNode.nodeValue.length - 1):(eNode.parentNode?eNode.parentNode.childNodes.length - 1:0));

		range.setStart(sNode, sOffset);
		range.setEnd(eNode, eOffset);

		return range;
	}catch(e){
		console.error(e);
		return null;
	}
}

function toNode(path, context){
	if(!path){
		return null;
	}

	var parts = path.split(/\s+>\s+/).map(part => part.replace(/^\s+|\s+$/g, '')).reverse(),
		wkNodes = [
			{ 'pattern': /^HTML[^A-z]*/i, 'node': document.documentElement }
		],
		part, p, node;

	while(parts.length){
		part = parts.pop();

		if(!node &&
		   (node = wkNodes.filter(wk => wk.pattern.test(part)).map(n => n.node)[0])
		  ){
			continue;
		}

		if(!node) return null;

		p = parsePathPart(part);

		if(!p){
			return null;
		}

		if(p.index >= 0){
			node = node.childNodes[p.index];
		}else{
			node = $(node).find(p.cssSel)[0];
		}
	}

	function parsePathPart(part){
		var match = part.match(/^\s*([^:]+)?(:index\((\d+)\))?\s*$/),
			cssSel, index;

		if(!match){
			return null;
		}

		cssSel = match[1];
		index = parseInt(match[3]);
		index = isNaN(index)?-1:index;

		return {
			'cssSel': cssSel,
			'index': index
		};
	}

	return node || null;
}

function toPath(node){
	if(!node || !node.nodeName){
		return null;
	}

	if(node === document.documentElement){
		return 'HTML';
	}

	var nodeName = node.nodeName,
		id = node.id,
		classes = getNodeClasses(node),
		path = nodeName,
		index = -1,
		hasId = false,
		hasClasses = false,
		prefix = null;
	
	if(['HTML'].indexOf(nodeName) >= 0){
		return nodeName;
	}

	if(id){
		path += '#'+id;
		hasId = true;
	}
	if(classes.length){
		if(!hasId){
			path += '.'+classes.join('.');
		}
		hasClasses = true;
	}
	
	if(node.parentNode){
		if(nodeName == '#text' || $(node.parentNode).find(path).length > 1){
			index = indexOfChild(node.parentNode, node);
			if(index === -1){
				return null;
			}else{
				path = (nodeName == '#text'?'':nodeName) + ':index('+index+')';
			}
		}
	}

	if(node !== document.documentElement){
		prefix = toPath(node.parentNode);
		if(prefix === null){
			return null;
		}
		path = prefix + (prefix.length?' > ':'') + path;;
	}

	return path;
}

function indexOfChild(parent, child){
	if(!parent || !child){
		return -1;
	}
	var i, index = -1, children = parent.childNodes;

	for(i=0;i<children.length;i++){
		if(children[i] === child){
			index = i;
		}
	}

	return index;
}

function getNodeClasses(node){
	if(!node){
		return null;
	}

	if(!node.className){
		return [];
	}

	var classes = node.className.replace(/^\s+|\s+$/g, '').split(/\s+/).filter(Boolean);

	return classes;
}

function getNodeAttrs(node){
	if(!node){
		return null;
	}

	if(!node.attributes){
		return {};
	}

	var attrs = {}, i, attr;

	for(i=0;i<node.attributes.length;i++){
		attr = node.attributes[i];
		attrs[attr.nodeName] = attr.nodeValue;
	}

	return attrs;
}
