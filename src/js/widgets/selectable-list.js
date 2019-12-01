"use strict";

const $ = require('jquery'),
	  SimpleEventEmitter = require('../base/simple-event-emitter'),
	  tmpls = require('../templates/widgets/selectable-list-tmpl');

const defaultState = {
	'items': [],
	'selected': {},
	'hidden': {}
};

const defaultConfig = {
	'enabled': true,
	'multi': false,
	'notEmpty': true,
	'sortable': false
};

module.exports = SelectableList;

function SelectableList(parentNode, config){
	if(!parentNode){
		throw "No parent node specified!";
	}

	SimpleEventEmitter.call(this);

	var self = this,
		conf = self._config = $.extend({}, defaultConfig, config || {}),
		domMap = self._domMap = {};

	self._state = parseState(self);

	self._state.items = conf.items || [];

	delete conf.items;

	function initDom(){
		domMap.parent = $(parentNode);
		domMap.main = $(tmpls.main()).appendTo(domMap.parent);
	}

	function initEvents(){
		domMap.main.on('click', '.docgaga-ui-selectable-list-item', selectHandler.bind(self));
	}

	function init(){
		parseState(self);		
		initDom();
		initEvents();
		self._render();
	}

	function destroy(){
		self.clearHandlers();

		self._state = null;

		domMap.main.remove();

		domMap = self._domMap = {};
	}

	self.destroy = destroy;

	init();
}

SelectableList.prototype = Object.create(SimpleEventEmitter.prototype);

SelectableList.prototype._setState = function(state, render){
	var self = this,
		oldState = $.extend({}, self._state),
		changed;

	$.extend(self._state, state);

	parseState(self);

	changed = diffState(oldState, self._state);

	if(render){
		self._render(changed);
	}
};

SelectableList.prototype.setVisibility = function(items, vis){
	items = items || [];

	var self = this,
		state = {},
		s = self._state,
		l = s.items.map(i => i.id);

	state.hidden = {};

	l.forEach(function(id){
		var v = items.indexOf(id) < 0;
		v = vis? v: !v;
		state.hidden[id] = v;
	});
	
	self._setState(state, true);
};

SelectableList.prototype.val = function(setVals){
	var self = this,
		curState = self._state,
		state, c;

	if(!setVals){
		return curState.items.filter(i => curState.selected[i.id]).map(i => i.id);
	}

	state = {};
	state.selected = {};
	c = 0;

	[].concat(setVals).filter(Boolean).forEach(function(id){
		c ++;
		if(!self._config.multi && c > 1){
			return;
		}
		state.selected[id] = true;
	});

	if(!self._config.notEmpty || c > 0){
		if(self.emit('before-change', { 'selected': $.extend({}, state.selected) }) !== false){
			self._setState(state, true);			
			self.emit('changed', { 'selected': $.extend({}, state.selected) });
		}
	}

	return self.val();
};

SelectableList.prototype._render = function(changed){
	var self = this,
		domMap = self._domMap,
		s = self._state, k;

	if(!changed || changed.items){
		if(!changed){
			s.items.forEach(function(i){
				var d = $(tmpls.listItem(i)).appendTo(domMap.main);
				d[0]._item = i;
			});
		}else{
			domMap.main.find('.docgaga-ui-selectable-list-item').each(function(index, d){
				var ni;

				if(changed.items.remove[d._item.id]){
					$(d).remove();
				}else if((ni = changed.items.modify[d._item.id])){
					d._item = ni;
					$(d).attr('data-id', ni.id);
					$(d).attr('data-value', ni.value);
					
					$(d).find('span[data-role=content]').html(ni.dom && typeof ni.dom == 'function' && ni.dom(ni) || ni.dom || ni.name || '-');
					if(ni.iconfont){
						$(d).find('span[data-role=icon]').text(ni.iconfont).data('icon', ni.iconfont).show();
						$(d).find('img[data-role=icon]').attr('src', '').hide();
					}else{
						$(d).find('span[data-role=icon]').text('').hide();
						$(d).find('img[data-role=icon]').attr('src', chrome.extension.getURL(ni.icon)).show();
					}
				}
			});

			changed.items.add.forEach(function(i){
				var d = $(tmpls.listItem(i));

				if(i.iconfont){
					$(d).find('img[data-role=icon]').data('icon', ni.iconfont).hide();
				}else{
					$(d).find('span[data-role=icon]').hide();
				}

				d.appendTo(domMap.main);
				d[0]._item = i;
			});

		}
	}

	if(!changed || changed.selected){
		domMap.main.find('.docgaga-ui-selectable-list-item').each(function(index, li){
			if((!!s.selected[li._item.id]) !== $(li).hasClass('docgaga-ui-selectable-list-item-selected')){
				$(li).toggleClass('docgaga-ui-selectable-list-item-selected');
			}
		});
	}

	if(!changed || changed.hidden){
		domMap.main.find('.docgaga-ui-selectable-list-item').each(function(index, li){
			if(s.hidden[li._item.id]){
				$(li).hide();
			}else{
				$(li).show();
			}
		});
	}
};

SelectableList.prototype.setEnabled = function(isEnabled){
	var self = this,
		state = {};
		
	state.enabled = !!isEnabled;

	self._setState(state);
};

SelectableList.prototype.isEnabled = function(){
	return self._state.enabled;
};

function selectHandler(event){
	var self = this,
		state = {},
		li = event.currentTarget._item?event.currentTarget:$(event.currentTarget).closest('.docgaga-ui-selectable-list-item')[0],
		item = li._item,
		t, k, ne;
	
	t = !!self._state.selected[item.id];

	if(self._config.multi){
		state.selected = $.extend({}, self._state.selected);
	}else{
		state.selected = {};
	}

	state.selected[item.id] = !t;

	for(k in state.selected){
		if(state.selected.hasOwnProperty(k) && state.selected[k]){
			ne = true;
			break;
		}
	}

	state.selected[item.id] = self._config.notEmpty && !ne?t:!t;

	if(self.emit('before-change', { 'selected': $.extend({}, state.selected) }) !== false){
		self._setState(state, true);
		self.emit('changed', { 'selected': $.extend({}, state.selected) });
	}
	
}

function diffState(oldState, newState){
	var changed = {},
		om, nm, k;

	for(k in newState){
		if(newState.hasOwnProperty(k)){
			changed[k] = newState[k] == oldState[k];
		}
	}

	changed.selected = true;

	for(k in nm){
		if(nm.hasOwnProperty(k) && (!!nm[k]) != (!!om[k])){
			changed.selected = true;
			break;
		}
	}

	if(!changed.selected){
		for(k in om){
			if(om.hasOwnProperty(k) && (!!om[k]) != (!!nm[k])){
				changed.selected = true;
				break;
			}
		}
	}

	changed.items = {
		'remove': {},
		'modify': {},
		'add': []
	};

	om = {};
	nm = {};

	oldState.items.forEach(i => om[i.value] = i);
	newState.items.forEach(i => nm[i.value] = i);

	for(k in om){
		if(om.hasOwnProperty(k)){
			if(!nm[k]){
				changed.items.remove[k] = true;
			}else if(nm[k].id != om[k].id){
				changed.items.modify[k] = nm[k];
			}
		}
	}

	for(k in nm){
		if(nm.hasOwnProperty(k) && !om[k]){
			changed.items.add.push(nm[k]);
		}
	}

	changed.hidden = true;

	return changed;
}

function parseState(self){
	if(!self._state){
		self._state = $.extend({}, defaultState);
	}

	var s = self._state,
		k, ne;

	s.items = s.items || [];

	s.selected = s.selected || {};

	ne = false;
	for(k in s.selected){
		if(s.selected.hasOwnProperty(k) && s.selected[k]){
			ne = true;
			break;
		}
	}

	if(self._config.notEmpty && !ne && s.items.length){
		s.selected[s.items[0].id] = true;
	}

	return s;
}

