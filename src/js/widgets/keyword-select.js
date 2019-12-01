const $ = require('jquery'),
	  SimpleEventEmitter = require('../base/simple-event-emitter'),
	  tmpls = require('../templates/keyword-select-tmpl'),
	  domInput = require('../utils/dom-input'),
	  strUtils = require('../utils/string-utils'),
	  debounce = require('lodash.debounce');

module.exports = KeywordSelect;

const defaultConfig = {
	'tip': '',
	'editable': true,
	'maxInputLength': 120,
	'maxItemCount': 5,
	'maxKeywordLength': 20,
	'emptyTip': '为笔记添加关键词，方便以后查找'
};

const defaultState = {
	'show': true,
	'keywords': [],
	'adding': false,
	'editing': null,
	'editKeyword': '',
	'adding': false,
	'newKeyword': '',
	'needToggleList': false,
	'listCollapsed': true,
	'showCandidates': true,
	'candLoading': false,
	'cands': [],
	'candInfo': '',
	'pendingCandLoad': null,
	'showTip': false,
	'emptyTip': ''
};

function KeywordSelect(parentNode, opts){
	if(!parentNode){
		throw "No parent node specified!";
	}

	SimpleEventEmitter.call(this);//call super

	opts = opts || {};

	var self = this,
		state = {},
		conf = self._config = $.extend({}, defaultConfig, opts),
		domMap = self._domMap = {};

	conf.emptyTip = conf.tip || conf.emptyTip;
	
	function initDom(){
		domMap.parent = $(parentNode);
		domMap.main = $(tmpls.main()).appendTo(domMap.parent);

		domMap.listWrapper = domMap.main.find('.docgaga-keyword-select-list');
		domMap.list = domMap.listWrapper.find('ul');
		domMap.listToggleBtn = domMap.listWrapper.find('a[data-role=toggle]');
		domMap.tip = domMap.list.find('li[data-role=tip]').text(conf.tip || '');

		domMap.candListWrapper = domMap.main.find('.docgaga-keyword-select-cand-list');
		domMap.candList = domMap.candListWrapper.find('ul');
		domMap.candCloseBtn = domMap.candListWrapper.find('a[data-role=close]');
		domMap.candInfo = domMap.candListWrapper.find('div[data-role=info]');

		domMap.editInputContainer = domMap.main.find('div[data-role=edit-keyword-container]');
		domMap.newInput = domMap.list.find('li input[data-role=new-keyword]');

		domMap.error = domMap.main.find('.docgaga-keyword-select-error-info');

		domMap.editInput = $(tmpls.editInput())
			.attr('disabled', conf.editable?null:'disabled')
			.appendTo(domMap.editInputContainer);

		domMap.editConfirm = $(tmpls.editConfirm());
		domMap.editCancel = $(tmpls.editCancel());
		domMap.addConfirm = $(tmpls.addConfirm());
		domMap.addCancel = $(tmpls.addCancel());

		domMap.addBtn = domMap.list.find('li a[data-role=add]');
	}
	
	function initEvents(){
		domMap.candCloseBtn.on('click', self._closeCandList.bind(self));

		domMap.candList.on('click', 'li.docgaga-keyword-select-cand-list-item', self._applyCandidate.bind(self));

		domMap.list.on('click', 'li a[data-role=delete]', self._deleteHandler.bind(self));
		domMap.list.on('click', 'li span[data-role=keyword]', self._editHandler.bind(self));
		domMap.listToggleBtn.on('click', self._toggleList.bind(self));

		domMap.addBtn.on('click', self._addHandler.bind(self));

		domMap.list.on('dblclick', 'input', function(event){
			if(!self._state.showCandidates){
				self._setState({ 'showCandidates': true }, true);
			}

			event.preventDefault();
			event.stopPropagation();
		});

		function keywordLengthValidator(options){
			options = options || {};
			return function(keyword){
				if(keyword.trim().length > self._config.maxKeywordLength){
					return {
						error: { 
							 msg: '关键词最多'+self._config.maxKeywordLength+'个字符' 
						}, 
						preventInput: options.preventInput,
						stopPropagation: options.stopPropagation
					};
				}
				return true;
			}
		}

		function keywordContentValidator(options){
			options = options || {};
			return function(keyword){
				if(/[,，]/.test(keyword)){
					return {
						error: {
							msg: '关键词不能包含逗号' 
						},
						preventInput: options.preventInput,
						stopPropagation: options.stopPropagation
					};
				}
				return true;
			}
		}

		function nonEmptyValidator(options){
			options = options || {};
			return function(keyword){
				if(!keyword || !keyword.trim().length){
					return {
						error: {
							msg: '内容不能为空'
						},
						preventInput: options.preventInput,
						stopPropagation: options.stopPropagation
					};
				}
				return true;
			}
		}

		function trimFormatter(options){
			return function(keyword){
				return keyword.trim();
			}
		}

		$([ domMap.newInput, domMap.editInput ]).each(function(index, ele){
			var role = $(ele).data('role'),
				type;
			
			if(role == 'edit-keyword'){
				type = 'edit';
			}else if(role == 'new-keyword'){
				type = 'new';
			}else{
				return;
			}

			domInput(ele).onKeyEsc(function(){
				if(type == 'edit'){
					self._cancelEdit();
				}else if(type == 'new'){
					self._cancelAdd();
				}
			}).onInput(function(event){
				var state = {};

				if(!event.changed){
					self._loadCandAndApply();
					if(type == 'edit'){
						state.editKeyword = $(ele).val();
					}else if(type == 'new'){
						state.newKeyword = $(ele).val();
					}
					self._setState(state, true);
				}
			}, {
				validators: [ 
					keywordLengthValidator({ preventInput: true, stopPropagation: true }),
					keywordContentValidator({ preventInput: false, stopPropagation: true })
				]
			}).onKeyEnter(function(){
				if(type == 'edit'){
					conf.editable && self._saveEdit();
				}else if(type == 'new'){
					conf.editable && self._saveAdd();
				}
			}, {
				preFormatters: [
					trimFormatter()
				],
				validators: [
					keywordLengthValidator({ preventInput: false, stopPropagation: true }),
					keywordContentValidator({ preventInput: false, stopPropagation: true })
				],
				postFormaters: [
					trimFormatter()
				]
			}).onError(function(err){
				err = err && err.error;
				if(err && err.msg){
					self.promptMsg(err.msg);
				}
			});
		});

		domMap.list.on('click', 'a[data-role=edit-confirm]', self._saveEdit.bind(self));
		domMap.list.on('click', 'a[data-role=edit-cancel]', self._cancelEdit.bind(self));

		domMap.list.on('click', 'a[data-role=add-confirm]', self._saveAdd.bind(self));
		domMap.list.on('click', 'a[data-role=add-cancel]', self._cancelAdd.bind(self));
		
	}

	function init(){
		state = {};
		parseState(self);
		initDom();
		initEvents();
		self._render();
	}

	function destroy(){
		self.clearHandlers();

		domMap.main.remove();

		domMap = self._domMap = {};

		self._state = null;

		state = {};
	}

	init();

	self.destroy = destroy;
}

KeywordSelect.prototype = Object.create(SimpleEventEmitter.prototype);

KeywordSelect.prototype.setSelectedKeywords = function(keywords, msg){
	var self = this,
		state = {};

	state.keywords = keywords || [];

	if(!state.keywords.length && msg){
		state.emptyTip = msg;
	}else{
		state.emptyTip = self._config.emptyTip;
	}

	state.adding = false;
	state.editing = false;

	self._setState(state, true);
};

KeywordSelect.prototype.getSelectedKeywords = function(){
	var self = this,
		s = self._state;

	return $.extend([], s.keywords);
};

KeywordSelect.prototype._applyLoadedCands = function(prom){
	var self = this;

	prom && prom.then(function(candList){
		if(candList && !self._state.pendingCandLoad){
			self._setState({ 'candInfo': '', 'candLoading': false, 'cands': candList }, true);
		}
	}).catch(function(e){
		self.promptMsg('查找失败T^T');
	}).then(function(){
		var args = self._state.pendingCandLoad;
		self._state.pendingCandLoad = null;
		if(args){
			setTimeout(function(){
				self._applyLoadedCands(self._loadCands(args.keyword, args.relatedKeywords));
			}, 0);
		}
	});
};

KeywordSelect.prototype._loadCandAndApply = debounce(function(curStr, otherKeywords){
	var self = this,
		s = self._state;

	if(curStr === undefined || curStr === null){
		if(s.adding){
			curStr = s.newKeyword.trim();
		}else if(s.editing){
			curStr = s.editKeyword.trim();
		}else{
			curStr = '';
		}
	}

	if(otherKeywords === undefined || otherKeywords === null){
		otherKeywords = s.keywords;
	}

	if(s.candLoading){
		s.pendingCandLoad = { 'keyword': curStr, 'relatedKeywords': otherKeywords };
	}else{
		self._applyLoadedCands(self._loadCands(curStr, otherKeywords));
	}
}, 300);

KeywordSelect.prototype._loadCands = function(curStr, otherKeywords){
	var self = this,
		s = self._state,
		m, ret, args;

	if(s.pendingCandLoad){
		args = s.pendingCandLoad;
		s.pendingCandLoad = null;

		curStr = args.keyword;
		otherKeywords = args.relatedKeywords;
	}

	curStr = curStr.trim().toLowerCase();

	m = {};

	s.keywords.forEach(i => m[i.object.keyword] = true);

	ret = self.emitFirst('load-cands', { 'keyword': curStr, 'relatedKeywords': otherKeywords });

	ret = Array.isArray(ret) && Promise.resolve(ret) || ret;
	
	if(!ret || typeof ret.then != 'function'){
		return Promise.resolve({ result: [] });
	}

	self._setState({ 'candLoading': true, 'candInfo': '正在查找可参考的关键词...' }, true);

	return ret.then(function(rs){
		var list = rs;

		return (list || [])
			.filter(i => !s.keywords.some(ii => ii.pk == i.pk));
	});
};

KeywordSelect.prototype.promptMsg = function(error){
	if(!error){
		return;
	}

	var self = this,
		domMap = self._domMap,
		s = self._state;

	if(!s.showError){
		setTimeout(function check(){
			var t = new Date().getTime();
			if(Math.abs(t - s.lastShowTime) < 1000){
				setTimeout(check, 1000);
				return;
			}
			domMap.error.fadeOut();
			s.showError = false;
			s.lastShowTime = 0;
		}, 1000);
		
		s.showError = true;
		show(domMap.error);
	}

	s.lastShowTime = new Date().getTime();

	domMap.error.find('span[data-role=content]').text(error || '');
};

KeywordSelect.prototype._applyCandidate = function(event){
	var li = $(event.currentTarget),
		kw = li.text(),
		self = this,
		s = self._state,
		state = {},
		saveEdit = false;

	if(s.adding && kw){
		state.newKeyword = kw;
	}else if(s.editing && kw){
		state.editKeyword = kw;
	}

	if(!self._config.fillCandidate || !self._config.editable && li[0]._item){
		if(s.adding){
			if(!s.keywords.some(i => i.object.keyword == kw)){
				state.keywords = $.extend([], s.keywords);
				state.keywords.unshift(li[0]._item);
			}
			state.adding = false;
		}else{
			saveEdit = true;
		}
	}

	if(state.newKeyword || state.editKeyword){
		self._setState(state, true);
	}

	if(saveEdit){
		self._saveEdit();
	}
};

KeywordSelect.prototype._closeCandList = function(event){
	var self = this,
		s = self._state,
		config = self._config,
		state = {},
		promptTip = false;

	state.showCandidates = false;

	if(!config.editable){
		state.adding = false;
		state.editing = false;
	}

	if(s.adding && !s.newInput){
		state.adding = false;
	}

	self._setState(state, true);

	promptTip = s.adding || s.editing;

	promptTip && self.promptMsg('双击输入框可显示参考关键词');
};

KeywordSelect.prototype._toggleList = function(event){
	var self = this,
		state = {};
	
	state.listCollapsed = !self._state.listCollapsed;

	self._setState(state, true);
};

KeywordSelect.prototype._deleteHandler = function(event){
	var self = this,
		target = $(event.currentTarget),
		state = {},
		li = target.closest('.docgaga-keyword-select-list-item');
	
	if(!li[0] || !li[0]._item || !li[0]._item.pk){
		return;
	}

	state.keywords = $.extend([], self._state.keywords).filter(i => i.pk != li[0]._item.pk);

	self._setState(state, true);
};

KeywordSelect.prototype._editHandler = function(event){
	var self = this,
		li = $(event.currentTarget).closest('.docgaga-keyword-select-list-item'),
		item = li[0]._item,
		state = {};

	if(!self._config.editable){
		state.keywords = self._state.keywords.filter(i => i !== item);

		self._setState(state, true);
	}else{
		state.adding = false;
		state.editing = item;
		state.editKeyword = item.object.keyword;
		state.showCandidates = true;
		
		self._setState(state, true);
		self._loadCandAndApply();
	}

	if(event && event.stopPropagation){
		event.stopPropagation();
	}
};

KeywordSelect.prototype._addHandler = function(event){
	var self = this,
		s = self._state,
		state = {};

	if(s.keywords.length >= self._config.maxItemCount){
		alert('你最多可以添加'+self._config.maxItemCount+'个关键词！');
		return;
	}

	if(s.editing){
		self._saveEdit();
		self._addHandler();
		return;
	}

	state.adding = true;
	state.newKeyword = '';
	state.showCandidates = true;

	self._setState(state, true);

	self._loadCandAndApply();
};

KeywordSelect.prototype._saveAdd = function(event){
	var self = this,
		s = self._state,
		state = {},
		nk, n, ret;

	s.newKeyword = self._domMap.newInput.val();

	nk = s.newKeyword.trim();

	if(!nk){
		self._cancelAdd();
		return;
	}

	if(s.keywords.some(i => i.object.keyword == nk)){
		alert('关键词"'+nk+'"已存在!');
		return;
	}

	n = { 'pk': null, 'object': { 'keyword': nk } };

	ret = self.emitFirst('save', { 'keyword': n });

	if(ret && typeof ret.then == 'function'){
		ret.then(function(n){
			if(!n){
				self.promptMsg('关键词添加失败');
				return;
			}

			var state = {};

			state.keywords = $.extend([], s.keywords);

			state.keywords.unshift(n);

			state.adding = false;
			state.newKeyword = '';

			self._setState(state, true);
		}).catch(function(e){
			self.promptMsg('关键词添加失败');
//			console.error(e);
		});
	}else{
		self.promptMsg('关键词添加失败');
	}
};

KeywordSelect.prototype._cancelAdd = function(event){
	var self = this,
		state = {};

	if(self._state.adding){
		state.adding = false;
		state.newInput = '';

		self._setState(state, true);
	}
};

KeywordSelect.prototype._saveEdit = function(event){
	var self = this,
		s = self._state,
		state = {},
		dd = false,
		cancel = false,
		i, tar, ek, nk, ret;
	
	s.editKeyword = self._domMap.editInput.val();

	if(s.editing){
		ek = s.editKeyword.trim();

		state.keywords = $.extend([], s.keywords);

		if(ek && state.keywords.some(i => i.pk != s.editing.pk && i.object.keyword == ek)){
			state.keywords = dedup(state.keywords);
		}

		for(i=0;i<state.keywords.length;i++){
			if(state.keywords[i].pk == s.editing.pk){
				break;
			}
		}

		if(i >= state.keywords.length ||
			 !state.keywords[i].object ||
			 state.keywords[i].object.keyword == ek){
			self._cancelEdit();
			return;
		}

		tar = state.keywords[i] = {
			pk: state.keywords[i].pk,
			object: {
				'keyword': ek
			}
		};

		ret = self.emitFirst('edit', { 'keyword': tar });

		if(ret && typeof ret.then == 'function'){
			ret.then(function(n){
				if(!n || !n.pk || !n.object || !n.object.keyword){
					self.promptMsg('关键词修改失败');
					return;
				}

				state.keywords[i] = n;
				state.editing = false;
				state.editKeyword = '';

				self._setState(state, true);

			}).catch(function(e){
				self.promptMsg('关键词修改失败');
			});
		}else{
			self.promptMsg('关键词修改失败');
		}
	}
};

KeywordSelect.prototype._cancelEdit = function(event){
	var self = this,
		state = {};

	state.editing = false;
	state.editKeyword = '';

	self._setState(state, true);
};

KeywordSelect.prototype._setState = function(state, render){
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

KeywordSelect.prototype._render = function(changed){
	var self = this,
		s = self._state,
		domMap = self._domMap,
		keywordModified = changed && changed.keywords && changed.keywords.add.length,
		dom, l, ll, li;
		
	
	if(!changed || changed.show){
		if(s.show){
			show(domMap.main);
		}else{
			hide(domMap.main);
			return;
		}
	}

	if(!changed || changed.showCandidates){
		if(s.showCandidates){
			show(domMap.candListWrapper);
			domMap.newInput.attr('title', '');
			domMap.editInput.attr('title', '');
		}else{
			hide(domMap.candListWrapper);
			domMap.newInput.attr('title', '双击查看参考关键词');
			domMap.editInput.attr('title', '双击查看参考关键词');
		}
	}

	if(!changed || changed.keywords){
		changed && domMap.list.find('.docgaga-keyword-select-list-item').each(function(index, li){
			var item = li._item,
				removed = false;

			if(changed.keywords.remove[item.pk]){
				$(li).remove();
				removed = true;
				keywordModified = keywordModified || true;
			}else if((item = changed.keywords.modify[item.pk])){
				li._item = item;
				$(li).find('span[data-role=keyword]')
					.text(item.object.keyword)
					.attr('title', strUtils.escapeHTML(item.object.keyword));

				keywordModified = keywordModified || true;
			}
		});

		changed && changed.keywords.add.forEach(function(i){
			dom = $(tmpls.listItem(i))
				.insertAfter(domMap.addBtn.closest('li'));
			
			dom.find('span[data-role=keyword]')
				.attr('title', i.object.keyword);

			!self._config.editable && dom.find('a[data-role=delete]').remove();

			dom[0]._item = i;
		});

		if(s.keywords.length < self._config.maxItemCount){
			show(domMap.addBtn.closest('li'));
		}

		domMap.list.attr('title', '关键词('+s.keywords.length+'): '+s.keywords.map(i => i.object.keyword).join(', '));
	}

	if(!changed || changed.editing){
		if(s.editing){
			domMap.list.find('.docgaga-keyword-select-list-item').filter(function(index, li){
				var editInput = $(li).find('input[data-role=edit-keyword]');

				if(editInput.length){
					show($(li).find('a[data-role=delete]'));
					show($(li).find('span[data-role=keyword]'));

					domMap.editCancel.appendTo(domMap.editInputContainer);
					domMap.editConfirm.appendTo(domMap.editInputContainer);
					domMap.editInput.appendTo(domMap.editInputContainer);
				}
				return li._item == s.editing;
			}).each(function(index, li){
				var kspan = $(li).find('span[data-role=keyword]');

				hide($(li).find('a[data-role=delete]'));

				domMap.editConfirm.insertBefore(kspan);
				domMap.editCancel.insertBefore(domMap.editConfirm);
				domMap.editInput.insertBefore(domMap.editCancel).val(s.editKeyword);

				domMap.editInput.focus();

				changed.editKeyword = true;

				hide(kspan);
			});
		}else{
			li = domMap.editInput.closest('.docgaga-keyword-select-list-item');

			show(li.find('a[data-role=delete]'));
			show(li.find('span[data-role=keyword]'));

			domMap.editInput.appendTo(domMap.editInputContainer);
			domMap.editConfirm.appendTo(domMap.editInputContainer);
			domMap.editCancel.appendTo(domMap.editInputContainer);
		}
	}

	if(!changed || changed.editKeyword){
		if(s.editing){
			l = (s.editKeyword.length) * 30;
			l = l > self._config.maxInputLength? self._config.maxInputLength: l;
			domMap.editInput.width(l);
			if(domMap.editInput.val() != s.editKeyword){
				domMap.editInput.val(s.editKeyword);
				domMap.editInput.focus();
			}
		}
	}

	if(!changed || changed.adding || s.keywords.length >= self._config.maxItemCount){
		if(s.adding && s.keywords.length < self._config.maxItemCount){
			show(domMap.newInput.val(''));
			domMap.addCancel.insertAfter(domMap.newInput);
			self._config.editable && domMap.addConfirm.insertAfter(domMap.addCancel);

			hide(domMap.addBtn);
			
			changed && (changed.newKeyword = true);

			domMap.newInput.focus();
		}else{
			show(domMap.addBtn);

			hide(domMap.newInput.val(''));
			domMap.addConfirm.remove();
			domMap.addCancel.remove();

			if(s.keywords.length >= self._config.maxItemCount){
				hide(domMap.addBtn.closest('li'));
			}
		}
	}

	if(!changed || changed.newKeyword){
		if(s.adding){
			l = Math.max((s.newKeyword.length) * 30, 80);
			l = l > self._config.maxInputLength? self._config.maxInputLength: l;
			domMap.newInput.width(l);
			if(domMap.newInput.val() != s.newKeyword){
				domMap.newInput.val(s.newKeyword);
				domMap.newInput.focus();
			}
		}
	}

	l = 0;

	domMap.list.find('li').each(function(index, i){
		if($(i).attr('data-role') == 'tip'){
			return;
		}
		l += $(i).width() + ['marginLeft', 'marginRight', 'paddingLeft', 'paddingRight', 'borderLeftWidth', 'borderRightWidth'].map(a => $.css(i, a, true)).reduce((s, a) => s + a);
	});

	ll = $(domMap.list).width() + ['paddingLeft', 'paddingRight'].map(a => $.css(domMap.list[0], a, true)).reduce((s, a) => s + a);

	if(l > ll){
		if(!s.needToggleList){
			changed && (changed.needToggleList = true);
			s.needToggleList = true;
		}
		if(s.adding || s.editing){
			changed && (changed.listCollapsed = true);
			s.listCollapsed = false;
		}
	}else{
		if(s.needToggleList){
			changed && (changed.needToggleList = true);
			s.needToggleList = false;
		}
		if(!s.listCollapsed){
			changed && (changed.listCollapsed = true);
			s.listCollapsed = true;
		}
	}

	if(!changed || changed.needToggleList){
		if(s.needToggleList){
			domMap.listWrapper.addClass('docgaga-keyword-select-list-need-toggle');
		}else{
			domMap.listWrapper.removeClass('docgaga-keyword-select-list-need-toggle');
		}
	}

	if(!changed || changed.listCollapsed){
		if(s.listCollapsed){
			domMap.listWrapper.addClass('docgaga-keyword-select-list-collapsed');
			domMap.listToggleBtn.html('expand_more');
			domMap.listToggleBtn.attr('title', '展开');
		}else{
			domMap.listWrapper.removeClass('docgaga-keyword-select-list-collapsed');
;
			domMap.listToggleBtn.html('expand_less');
			domMap.listToggleBtn.attr('title', '收起');
		}
	}

	if(!changed || changed.showTip){
		if(s.showTip){
			show(domMap.tip.text(s.emptyTip || '').width('auto'));
		}else{
			hide(domMap.tip.width(0));
		}
	}

	if(!changed || changed.candInfo){
		if(s.candInfo){
			if(!s.cands.length){
				show(domMap.candInfo.text(s.candInfo));
				hide(domMap.candList);
			}else{
				hide(domMap.candInfo.text(s.candInfo));
				show(domMap.candList);
			}
		}else{
			hide(domMap.candInfo.text(''));
			show(domMap.candList);
		}
	}

	if(!changed || changed.cands || !s.candLoading){//to-do
		domMap.candList.empty();
		s.cands.forEach(function(i){
			var dom = $(tmpls.candListItem(i)).appendTo(domMap.candList);
			dom[0]._item = i;
		});
	}

	if(keywordModified){
		self.emit('change', {}, { 'async': true });
	}
};

KeywordSelect.prototype.show = function(){
	var self = this;

	self._setState({ 'show': true }, true);
};

KeywordSelect.prototype.hide = function(){
	var self = this;

	self._setState({ 'show': false }, true);
};

KeywordSelect.prototype.updateView = function(){
	var self = this;

	self._render();
};

function diffState(oldState, newState){
	var changed = {},
		k, om, nm;

	for(k in newState){
		if(newState.hasOwnProperty(k) && newState[k] != oldState[k]){
			changed[k] = true;
		}
	}

	om = {};
	nm = {};

	oldState.keywords.forEach(i => om[i.pk] = i);
	newState.keywords.forEach(i => nm[i.pk] = i);

	changed.keywords = {
		'remove': {},
		'modify': {},
		'add': []
	};

	for(k in nm){
		if(nm.hasOwnProperty(k) && !om[k]){
			changed.keywords.add.push(nm[k]);
		}else if(nm.hasOwnProperty(k) && om[k].object.keyword != nm[k].object.keyword){
			changed.keywords.modify[k] = nm[k];
		}
	}

	for(k in om){
		if(om.hasOwnProperty(k) && !nm[k]){
			changed.keywords.remove[k] = true;
		}
	}

	if(changed.adding){
		changed.newKeyword = true;
	}

	if(!newState.candLoading && newState.cands.length && newState.candInfo){
		changed.candInfo = true;
		newState.candInfo = '';
	}else if(!newState.candLoading && !newState.cands.length && !newState.candInfo){
		changed.candInfo = true;
		newState.candInfo = '无可参考关键词~_~';
	}else if(newState.candLoading && !newState.candInfo){
		newState.candInfo = '正在查找可参考的关键词...';
	}

	if(newState.adding){
		changed.newKeyword = true;
	}else if(newState.editing){
		changed.editKeyword = true;
	}
	
	return changed;
}

function parseState(self){
	var s = self._state,
		c = self._config;

	if(!s){
		s = self._state = $.extend({}, defaultState, {
			'emptyTip': c.emptyTip
		});
	}

	s.keywords = dedup(s.keywords || []);
	
	if((s.keywords.length > self._config.maxItemCount) || (s.adding && s.editing)){
		s.adding = false;
	}

	if(!s.adding && s.newKeyword){
		s.newKeyword = '';
	}

	if(!s.editing && s.editKeyword){
		s.editKeyword = '';
	}

	if(!s.editing && !s.adding){
		s.showCandidates = false;
	}

	if(!s.keywords.length && !s.adding){
		s.showTip = true;
	}else{
		s.showTip = false;
	}

	if(!s.needToggleList && !s.listCollapsed){
		s.listCollapsed = true;
	}

	return s;
}

function dedup(keywords){
	var m = {},
		km = {};

	return (keywords || []).filter(function(i){
		var r = i && i.pk && !m[i.pk] && i.object && i.object.keyword && !km[i.object.keyword];

		if(r){
			m[i.pk] = true;
			km[i.object.keyword] = true;
		}

		return r;
	});
}

function show(dom){
	$(dom).attr('hidden', false).show();
}

function hide(dom){
	$(dom).attr('hidden', true).hide();
}
