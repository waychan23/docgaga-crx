"use strict";

const $ = require('jquery');
const debounce = require('lodash.debounce');
const SimpleEventEmitter = require('../base/simple-event-emitter'),
	  NoteItem = require('../model/note-item'),
	  cate = require('../model/note-category'),
	  domTmpl = require('../templates/note-panel-tmpl'),
	  SelectableList = require('../widgets/selectable-list'),
	  KeywordSelect = require('../widgets/keyword-select'),
	  domPos = require('../utils/dom-position'),
	  makeMovable = require('../utils/dom-movable').makeMovable,
	  asap = require('../utils/asap'),
	  selUtils = require('../utils/selection-utils'),
	  nodePathUtils = require('../utils/node-path-utils'),
	  urlUtils = require('../utils/url-utils'),
	  timeUtils = require('../utils/time-utils'),
	  keywordService = require('../services/keyword-service'),
	  preventDefaultAndStopPropagation = require('../utils/event-utils').preventDefaultAndStopPropagation;
	
const defaultState = {
	'note': null,
	'show': false,
	'setTop': false,
	'setMax': false,
	'textCollapsed': false,
	'noteType': cate.cateId.CATEGORY_NOTE_MARK_NOTE,
	'for': 'create', //[update|create]
	'enableEditNote': true,
	'enableToggleText': true,
	'enableDelete': true,
	'enableSave': true,
	'enableNoteTypeSelect': true,
	'enableLocate': true,
	'enableSetTop': true,
	'enableSetMax': true,
	'enableMove': true,
	'footerInfo': ''
};

module.exports = NotePanel;

function NotePanel(options){

	options = options || {};

	SimpleEventEmitter.call(this);

	var self = this,
		domMap = self.domMap = {},
		store = self.store = {},
		state;

	store.noteItem = options.store.noteItem;
	store.keyword = options.store.keyword;

	function init(){
		state = self._state = parseState(self),
		initDom();
		initEvents();
		self._render();
	}

	function destroy(){
		self.clearHandlers();

		self.domMap._movableObject.destroy();
		self.domMap.keywordSelect.destroy();
		self.domMap.typeSelect.destroy();

		self.domMap.main.remove();

		state = self._state = null;

		domMap = self.domMap = {};
	}

	function initDom(){
		domMap.parent = $(document.body);
		domMap.main = $(domTmpl.main()).appendTo(domMap.parent);
		domMap.header = domMap.main.find('.docgaga-note-panel-header');
		domMap.title = domMap.header.find('span[data-role=docgaga-note-panel-title]');
		domMap.footer = domMap.main.find('.docgaga-note-panel-footer');

		domMap.footerInfo = domMap.footer.find('div[data-role=info]');

		domMap.locateBtn = domMap.main.find('.docgaga-note-panel-locate-btn');

		domMap.setTopBtn = domMap.main.find('.docgaga-note-panel-set-top-btn');
		domMap.setMaxBtn = domMap.main.find('.docgaga-note-panel-max-btn');
		domMap.closeBtn = domMap.main.find('.docgaga-note-panel-close-btn');

		domMap.saveBtn = domMap.main.find('.docgaga-note-panel-save-btn');
		domMap.deleteBtn = domMap.main.find('.docgaga-note-panel-delete-btn');

		domMap.textToggleBtn = domMap.main.find('.docgaga-note-panel-text-toggle-btn');

		domMap.mainPanel = domMap.main.find('.docgaga-note-panel-main');
		domMap.textContent = domMap.main.find('.docgaga-note-panel-text-content');
		domMap.noteArea = domMap.main.find('.docgaga-note-panel-textarea');

		domMap.keywordSelectWrapper = domMap.main.find('.docgaga-note-panel-keyword-select');

		domMap.typeSelect = new SelectableList(domMap.main.find('.docgaga-note-panel-type-select-list'), {
			'items': (function(){
				var items = [],
					id, c;
				
				for(id in cate.cates){
					if(cate.cates.hasOwnProperty(id)){
						c = cate.cates[id];
						if(!c.hasMark){
							//continue;
						}
						items.push({
							'id': c.id,
							'name': c.name,
							'value': c.id,
							'order': c.order || 0,
							'iconfont': c.iconfont,
							'desc': c.desc || c.name
							//dom: xxx,
							//render: xxx
						});
					}
				}
				
				return items.sort((a, b) => a.order - b.order);
			}())
		});

		domMap.keywordSelect = new KeywordSelect(domMap.keywordSelectWrapper, {
			'tip': '为笔记添加关键词，方便以后查找',
			'editable': true
		});

		domMap._movableObject = makeMovable(domMap.main, domMap.header, {
			'inBoundry': true, 'transparent': true, 'cursor': 'move',
			'useBottom': true
		});

	}

	function initEvents(){
		domMap.setTopBtn.on('click', self.setTop.bind(self));
		domMap.setMaxBtn.on('click', self.setMax.bind(self));
		domMap.textToggleBtn.on('click', self.toggleText.bind(self));

		domMap.noteArea.on('input', self._updateNoteContent.bind(self));
		domMap.typeSelect.on('changed', self._updateNoteType.bind(self));

		domMap.locateBtn.on('click', self.locateText.bind(self));
		domMap.closeBtn.on('click', self.hide.bind(self));

		domMap.main.on('mousedown mouseup', '.docgaga-note-panel-layout-btn', function(event){
			event.stopPropagation();
			self.fireEvent('focus');
		});

		domMap.main.on('mouseup', function(event){
			event.preventDefault();
			self.fireEvent('focus');
		});

		domMap.deleteBtn.on('click', function(event){
			preventDefaultAndStopPropagation(event);
			if(window.confirm('确定要删除该笔记？')){
				self.deleteNote();
			}
		});

		domMap.footerInfo.on('click', 'a[data-role=remote-open]', function(event){
			preventDefaultAndStopPropagation(event);

			var target = $(event.currentTarget),
				url = target.attr('data-url'),
				noteId = target.attr('data-noteId');
			
			self.fireEvent('remote-note-open', { url: url, noteId: noteId });
		});

		domMap.keywordSelect.on('load-cands', loadKeywordCands.bind(self));

		domMap.keywordSelect.on('edit', saveKeyword.bind(self));

		domMap.keywordSelect.on('save', saveKeyword.bind(self));

		domMap.keywordSelect.on('change', changeKeywords.bind(self));

		self.setSaveHandler(function(object, update){
			if(update){
				return store.noteItem.update(object);
			}else{
				return store.noteItem.save(object.object);
			}
		});
	}

//	init();

	self.bootstrap = init;

	self.destroy = destroy;
}

function changeKeywords(){
	var self = this,
		domMap = self.domMap,
		s = self._state,
		note = s.note,
		keywords;
	
	if(!note){
		return;
	}

	keywords = domMap.keywordSelect.getSelectedKeywords() || [];

	note.object.keywords = keywords.map(i => i.pk);
}

function saveKeyword(args){
	var self = this,
		keyword = args.keyword,
		store = self.store.keyword;

	if(!keyword || !keyword.object || !keyword.object.keyword){
		return Promise.reject('No keyword specified to save.');
	}

	return store.search({ keyword: keyword.object.keyword }, { project: { keyword: true } })
		.then(function(rs){
			if(!rs || !rs.result){
				rs = { result: [] };
			}

			if(rs.result[0]){
				return rs.result[0];
			}
			
			return store.save(keyword.object);
		});
}

function loadKeywordCands(args){
	var self = this,
		keyword = args.keyword || '',
		relatedKeywords = args.relatedKeywords || [],
		store = self.store.keyword;

	return store.search({
		searchStr: keyword
	}, {
		project: { keyword: 1 },
		pagination: { pageNo: 1, pageSize: 60 }
	}).then(function(rs){
		if(!rs || !rs.result){
			return [];
		}

		return rs.result;
	});
}

function setPosition(target, pos){
	if(target && (target = $(target)) && target.css){
		target.css(pos);
	}
}

function unsetPosition(target){
	target && (target = $(target)) && target.css && target.css({
		'left': '',
		'right': '',
		'top': '',
		'bottom': ''
	});
}

function recoverPosition(target){
	if(!target || !(target = $(target)[0])){
		return;
	}
	if(target._savedPosition){
		asap(function(){
			var pos = domPos.avoidOutOfClient(target, {
				'clientX': target._savedPosition.left,
				'clientY': $(window).outerHeight() - target._savedPosition.bottom - $(target).height()
			});
			
			setPosition(target, {
				'left': pos.clientX,
				'bottom': $(window).outerHeight() - (pos.clientY + $(target).height())
			});
		});
	}else{
		unsetPosition(target);
	}
}

NotePanel.prototype = Object.create(SimpleEventEmitter.prototype);

NotePanel.prototype._updateNoteContent = function(event){
	preventDefaultAndStopPropagation(event);

	var self = this,
		domMap = self.domMap,
		curState = self._state,
		state = {};

	if(curState.note && curState.note.object){
		state.note = curState.note; //not so good
		state.note.object.note = domMap.noteArea.val(); //state.note.object.note
			
		self._setState(state, true);
	}
};

NotePanel.prototype._updateNoteType = function(event){
	preventDefaultAndStopPropagation(event);
	
	var self = this,
		state = {},
		curState = self._state,
		domMap = self.domMap;

	state.noteType = domMap.typeSelect.val()[0];

	if(curState.note && curState.note.object){
		state.note = curState.note; //not so good
		state.note.object.noteType = state.noteType;
	}

	state.enableEditNote = cate.cates[state.noteType].editable;

	self._setState(state, true);
};

NotePanel.prototype.setSaveHandler = function(saveHandler){
	var self = this,
		domMap = self.domMap;

	if(typeof saveHandler != 'function'){
		return;
	}

	domMap.saveBtn.on('click', function(event){
		if(!self._state.enableSave){
			return;
		}

		var note = self._state.note;

		if(!note){
			return;
		}

		var update = !!note.pk,
			retVal;

		if(!cate.cates[note.object.noteType].hasMark && !(note.object.note || '').trim()){
			alert('请输入笔记内容');
			return;
		}

		if(!note.object.keywords || !note.object.keywords.length){
			domMap.keywordSelect.promptMsg('请添加至少一个关键词!');
			return;
		}

		retVal = saveHandler.call(self, note, update);

		self._setState({ saving: false }, true);

		if(retVal instanceof Promise){
			retVal.then(function(result){
				if(!result){
					throw "result="+result;
				}

				note.pk = note.pk || result.pk;
				
				self.fireEvent('save-success', {
					'note': note
				});

				console.log('保存成功!');
			}).catch(function(error){
				console.log('保存失败: '+error);
			});
		}
	});
};

NotePanel.prototype.show = function(selection){
	var self = this,
		state = {},
		s = selUtils.extendRange(selection.selection.getRangeAt(0));

	if(!s){
		return;
	}

	state.show = false;
	state.setTop = state.setMax = false;
	state.enableToggleText = true;
	state.textCollapsed = false;
	state.enableMove = true;

	self._setState(state, true);

	self.store.noteItem.findByMark({
		startPath: nodePathUtils.toPath(s.startContainer),
		endPath: nodePathUtils.toPath(s.endContainer),
		startOffset: s.startOffset,
		endOffset: s.endOffset,
		url: urlUtils.getCurPageUrl()
	}).then(function(note){
		if(!note || !note.result){
			note = { result: [] };
		}
		note = note? note.result: [];

		note = note && note[0];

		if(!note){
			note = NoteItem({
				'object': {
					'keywords': [],
					'noteType': cate.cateId.CATEGORY_MARK,
					'startPath': nodePathUtils.toPath(s.startContainer),
					'startOffset': s.startOffset,
					'endPath': nodePathUtils.toPath(s.endContainer),
					'endOffset': s.endOffset,
					'text': selUtils.parseRangeForText(s),
					'note': ''
				}
			});
		}

		self.applyNote(note);
	});
};

NotePanel.prototype._savePosition = function(pos){
	var self = this,
		target = $(self.domMap.main)[0];

	target._savedPosition = pos || {
		'left': $.css(target, 'left', true),
		'bottom': $.css(target, 'bottom', true)
	};
};

NotePanel.prototype.setMax = function(){
	var self = this,
		state = {},
		domMap = self.domMap;

	state.setMax = !self._state.setMax;
	state.setTop = false;
	state.enableMove = !state.setMax;
	state.textCollapsed = false;
	state.enableToggleText = !state.setMax;

	self._setState(state, true);

	domMap.keywordSelect.updateView();
};

NotePanel.prototype.setTop = function(){
	var self = this,
		state = {},
		domMap = self.domMap;

	state.setTop = !self._state.setTop;
	state.setMax = false;
	state.enableMove = !state.setTop;
	state.textCollapsed = false;
	state.enableToggleText = !state.setTop;

	self._setState(state, true);

	domMap.keywordSelect.updateView();
};

NotePanel.prototype.hide = function(event){
	var self = this,
		state = {};

	state.show = false;
	state.note = null;
	
	self._setState(state, true);
};

function textSelectionFilter(selection){
	var range = selection.getRangeAt(0);
	if(!range){
		return false;
	}
	if($(range.endContainer).closest('.docgaga-note-list-panel,.docgaga-note-panel,.docgaga-op-menu,.docgaga-result-panel').length || 
		$(range.startContainer).closest('.docgaga-note-list-panel,.docgaga-note-panel,.docgaga-op-menu,.docgaga-result-panel').length){
		return false;
	}

	return true;
}

NotePanel.prototype.applyNote = debounce(function(note, isNew, opts){
	opts = opts || {
		selectRange: true,
		locateRange: true
	};

	var self = this,
		state = {},
		s = self._state,
		loc, r, n, type;

	isNew = (isNew === true || !note || !note.pk);

	type = note && note.object && note.object.noteType;

	if(note && (!type || !cate.cates[type])){
		console.warn('unknown note type: ', type);
		return false;
	}

	if(!type){
		type = cate.cateId.CATEGORY_NOTE;
	}
	
	type = cate.cates[type];

	if(type.hasMark && !(note.object.text || '').trim()){
		console.warn('note of type ', type, ' must have marked text.');
		return false;
	}

	if(isNew){
		n = { object: {} };
		if(type.hasMark){
			n.object.text = note.object.text || '';
			n.object.startPath = note.object.startPath;
			n.object.endPath = note.object.endPath;
			n.object.startOffset = note.object.startOffset;
			n.object.endOffset = note.object.endOffset;
		}

		n.object.noteType = type.id;
		n.object.keywords = [];
		n.object.note = '';

		state.setMax = false;
		state.setTop = false;
		
	}else{
		n = note;
	}

	state.note = n = NoteItem.parse(n);
	state.noteType = state.note.object.noteType;
	state.for = isNew? 'create': 'update';
	state.textCollapsed = type.hasMark?false: true;
	state.enableToggleText = type.hasMark?true: false;
	state.enableDelete = (state.for == 'update');

	if(type.hasMark && (state.for == 'create' || n.inCurPage)){
		r = nodePathUtils.toRange(
			n.object.startPath,
			n.object.startOffset,
			n.object.endPath,
			n.object.endOffset
		);
	}

	self._setState(state, true);

	s = self._state;

	if(s.for == 'update'){
		self.domMap.keywordSelect.setSelectedKeywords([], '加载中...');
		
		getKeywordsByIds(self.store.keyword, self._state.note.object.keywords || []).then(function(list){
			if(!list || !list.result){
				list = { result: [] };
			}

			list = list.result;
			
			self.domMap.keywordSelect.setSelectedKeywords(list);
			self.domMap.keywordSelect.updateView();
		});
	}else{
		self.domMap.keywordSelect.setSelectedKeywords([], '正在推荐关键词...');
		getKeywordSuggestions(self.store, {
			text: $(s.commonAncestorContainer).text()
		}).then(function(list){
			if(!list || !list.result){
				list = { result: [] };
			}

			list = list.result;

			self.domMap.keywordSelect.setSelectedKeywords(list);

			if(list.length){
				self._state.note.object.keywords = list.map(i => i.pk);
				self.domMap.keywordSelect.promptMsg('自动推荐关键词');
			}
		}).catch(function(e){
			console.error(e);
			self.domMap.keywordSelect.setSelectedKeywords([]);
		}).then(function(){
			self.domMap.keywordSelect.updateView();
		});	
	}

	s = self._state;

	if(type.hasMark && (n.inCurPage || s.for == 'create')){
		loc = 'left-bottom';
	}else{
		loc = 'center-middle';
	}

	setPositionTo.call(self, self.domMap.main, loc, 'andThenShow');

	asap(function(){
		self.domMap.noteArea.focus();

		if(!r && n.inCurPage && n.object.text){
			r = selUtils.locateByText(n.object.text, textSelectionFilter);

			if(r && r.range){
				r = r.range;
			}
		}

		if(r && opts.selectRange){
			selUtils.selectRange(r);
		}

		if(r && opts.locateRange){
			selUtils.locateRange(r);
		}

	});

	return true;
}, 300);

NotePanel.prototype.createNote = function(){
	var self = this;

	self.applyNote();
};

NotePanel.prototype.openNote = function(notePk){
	if(!notePk){
		return;
	}

	var self = this,
		state = {},
		store = self.store.noteItem,
		n, prom, oldKws, newKws;

	if(self._state.show && self._state.note && self._state.note.pk == notePk){
		prom = Promise.resolve(self._state.note);
	}else{
		prom = store.get(notePk);
	}

	prom.catch(function(error){
		console.error(error);
	}).then(function(note){
		if(note){
			self.applyNote(note);
		}else{
			alert('笔记不存在');
		}
	});
};

NotePanel.prototype.isOpen = function(){
	return this._state.show;
}

NotePanel.prototype.getNote = function(){
	var self = this,
		s = self._state;
	return s.note;
};

NotePanel.prototype.deleteNote = function(){
	var self = this,
		store = self.store.noteItem,
		notePk = self._state.note && self._state.note.pk;

	if(!self._state.enableDelete || !notePk){
		self.hide();
		return Promise.resolve();
	}

	return store.delete(notePk).then(function(event){
		console.log('object[pk='+notePk+'] deleted!');
	}).catch(function(error){
		console.error(error);
		alert("删除失败");
	}).then(function(){
		self.hide();
		self.fireEvent('delete-success', { 'pk': notePk });
	});
};

NotePanel.prototype.toggleText = function(show){
	var self = this,
		state = {},
		domMap = self.domMap;

	if(show !== true && show !== false){
		show = self._state.textCollapsed;
		if(!self._state.enableToggleText){
			return;
		}
	}

	state.textCollapsed = !show;

	self._setState(state, true);
};

NotePanel.prototype.locateText = debounce(function(event){
	preventDefaultAndStopPropagation(event);

	var self = this,
		domMap = self.domMap,
		note = self._state.note,
		range;

	if(note && self._state.enableLocate){
		range = note.range;
		if(!range && note.object && note.object.text){
			range = selUtils.locateByText(note.object.text, textSelectionFilter);
			if(range && range.range){
				range = range.range;
			}
		}
		if(range){
			selUtils.selectRange(range);
			selUtils.locateRange(range);
		}
	}
}, 300);

NotePanel.prototype.getZIndex = function(){
	var self = this,
		domMap = self.domMap,
		zIndex;

	zIndex = parseInt(domMap.main.css('z-index'));

	if(!isNaN(zIndex)){
		return zIndex;
	}

	return null;
};

NotePanel.prototype.setZIndex = function(zindex){
	if(isNaN(parseInt(zindex))){
		return;
	}

	var self = this,
		domMap = self.domMap;

	domMap.main.css('z-index', zindex);
};

NotePanel.prototype._setState = function(state, render){
	if(!state){
		return;
	}

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

NotePanel.prototype._render = function(changed){
	var self = this,
		s = self._state,
		domMap = self.domMap,
		t, c, sel;
	
	if(!changed || changed.note){
		if(!s.note || s.note.inCurPage){
			domMap.title.text('汤圆笔记').prop('title', '');
		}else{
			if(s.note.object && s.note.object.pageTitle){
				domMap.title.text(s.note.object.pageTitle).prop('title', '页面标题: '+s.note.object.pageTitle);
			}else{
				domMap.title.text('汤圆笔记').prop('title', '');
			}
		}
	}
	
	if(!changed || changed.enableLocate){
		if(s.enableLocate){
			domMap.locateBtn.show();
		}else{
			domMap.locateBtn.hide();
		}
	}

	if(!changed || changed.setTop){
		if(s.setTop){//setTop
			if(changed && changed.setMax){//from max to top
				domMap.main.removeClass('docgaga-note-panel-max');
			}else{//from default to top
				self._savePosition();
			}
			unsetPosition(domMap.main);
			domMap.main.addClass('docgaga-note-panel-set-top');
			domMap.setTopBtn.text('vertical_align_bottom');
		}else{//setDefault
			if(!s.setMax && changed && changed.setTop){//from top to default
				recoverPosition(domMap.main);
			}
			domMap.setTopBtn.text('vertical_align_top');
		}
	}

	if(!changed || changed.setMax){
		if(s.setMax){//setMax
			if(changed && changed.setTop){//from top to max
				domMap.main.removeClass('docgaga-note-panel-set-top');
			}else{//from default to max
				self._savePosition();
			}
			unsetPosition(domMap.main);
			domMap.main.addClass('docgaga-note-panel-max');
			domMap.setMaxBtn.text('fullscreen_exit');
		}else{//setDefault
			if(!s.setTop && changed && changed.setMax){//from max to default
				recoverPosition(domMap.main);
			}
			domMap.setMaxBtn.text('fullscreen');
		}
	}

	if((!changed || (changed.setTop || changed.setMax)) &&
	   (!s.setTop && !s.setMax)){//setTop or setMax changed and to default layout
		domMap.main
			.removeClass('docgaga-note-panel-set-top')
			.removeClass('docgaga-note-panel-max');
	}

	if(!changed || changed.enableMove){
		if(s.enableMove){
			domMap._movableObject.enable();
		}else{
			domMap._movableObject.disable();
		}
	}

	if(!changed || changed.enableToggleText){
		if(!s.enableToggleText){
			domMap.textToggleBtn.attr('title', '标记内容');
		}
	}

	if(!changed || changed.textCollapsed || (changed.enableToggleText && s.enableToggleText)){
		if(s.textCollapsed){
			domMap.mainPanel.addClass('docgaga-note-panel-text-collapsed');
			domMap.textToggleBtn.attr('title', '显示标记内容');
		}else{
			domMap.mainPanel.removeClass('docgaga-note-panel-text-collapsed');
			domMap.textToggleBtn.attr('title', '隐藏标记内容');
		}
	}

	if(!changed || changed.enableEditNote){
		if(s.enableEditNote){
			domMap.noteArea.attr('disabled', null);
		}else{
			domMap.noteArea.attr('disabled', 'disabled');
		}
	}

	if(!changed || changed.enableSave){
		if(s.enableSave){
			domMap.saveBtn.show();
		}else{
			domMap.saveBtn.hide();
		}
	}

	if(!changed || changed.enableDelete){
		if(s.enableDelete){
			domMap.deleteBtn.show();
		}else{
			domMap.deleteBtn.hide();
		}
	}

	if(!changed || changed.enableLocate){
		if(s.enableLocate){
			domMap.locateBtn.show();	
		}else{
			domMap.locateBtn.hide();
		}
	}

	if(!changed || changed.enableNoteTypeSelect){
		domMap.typeSelect.setEnabled(s.enableNoteTypeSelect);
	}

	if(!changed || changed.noteType){
		t = cate.cates[s.noteType];
		if(t){
			if(t.hasMark){
				domMap.typeSelect.setVisibility([ cate.cateId.CATEGORY_NOTE ], false);
				domMap.main.removeClass('docgaga-note-panel-no-text');
			}else{
				domMap.typeSelect.setVisibility([ cate.cateId.CATEGORY_NOTE ], true);
				domMap.main.addClass('docgaga-note-panel-no-text');
			}
			if(domMap.typeSelect.val()[0] != t.id){
				domMap.typeSelect.val(t.id);
			}
			domMap.noteArea.attr('placeholder', '你可以在此输入'+ (t.contentName || t.name || ''));
		}
	}

	if(!changed || changed.note){
		if(s.note && s.note.object){
			domMap.textContent.text(s.note.object.text || '');
			domMap.noteArea.val(s.note.object.note || '');
		}
	}

	if(!changed || changed.note){
		if(s.footerInfo){
			domMap.footerInfo.html(s.footerInfo);
		}else{
			domMap.footerInfo.text('');
		}
	}

	if(!changed || changed.show){
		if(s.show && domMap.main){
			domMap.main.show();
			domMap.keywordSelect.updateView();
			if(s.enableEditNote){
				domMap.noteArea.focus();
			}
			asap(function(){
				domMap.noteArea.scrollTop(0);
			});
		}else{
			domMap.main.hide();
		}
	}
};

function getKeywordsByIds(store, ids){
	ids = ids || [];

	if(!ids.length){
		return Promise.resolve([]);
	}

	return keywordService.queryByIds({ 'ids': ids })
		.catch(function(e){
		}).then(function(rs){
			if(rs){
				return rs;
			}
			if(!store){
				return false;
			}

			return store.search({ '_id': ids }, { project: { keyword: true } });
		});
}

function diffState(oldState, newState){
	if(!oldState || !newState){
		return null;
	}

	var prop, changed = {};

	for(prop in newState){
		if(newState.hasOwnProperty(prop) &&
		   newState[prop] != oldState[prop] &&
		   prop != 'note'){
			changed[prop] = true;
		}
	}

	changed.note = (!oldState.note || !newState.note) ||
		(!newState.pk) || 
		(oldState.note && newState.note && oldState.note.pk != newState.note.pk);

	return changed;
}

function parseState(inst){
	if(!(inst instanceof NotePanel)){
		return null;
	}
	if(!inst._state){
		inst._state = $.extend({}, defaultState);
		return inst._state;
	}

	var s = inst._state,
		link, tooltip;

	['show', 'setTop', 'setMax', 'textCollapsed', 'enableEditNote',
	 'enableToggleText', 'enableDelete', 'enableSave', 'enableNoteTypeSelect',
	 'enableLocate', 'enableSetTop', 'enableSetMax', 'enableMove']
		.forEach(function(prop){
			s[prop] = !!s[prop];
		});

	if(s.setTop && s.setMax){
		s.setMax = false;
	}

	if(!s.enableSetTop){
		s.setTop = false;
	}

	if(!s.enableSetMax){
		s.setMax = false;
	}

	s.noteType = cate.cates[s.noteType] && s.noteType || cate.cateId.CATEGORY_MARK;

	if(s.note && s.note.object && s.note.object.noteType != s.noteType){
		s.noteType = s.note.object.noteType;
	}

	if(cate.cates[s.noteType].hasMark){
		if(s.setTop || s.setMax){
			s.enableToggleText = false;
		}
		if(!s.enableToggleText){
			s.textCollapsed = false;
		}
	}else{
		s.textCollapsed = true;
		s.enableToggleText = false;
	}

	s.for = s.for && ['update', 'create'].indexOf(s.for) >= 0? s.for:'update';
	
	if(s.for == 'update' && s.note && !s.note.inCurPage){
		s.enableLocate = false;

		link = 'http://'+s.note.object.url;
		tooltip = s.note.object.pageTitle + '\n- ' + link;

		s.footerInfo = $('<a></a>').text('该笔记来自其他页面')
			.append('<span data-role="icon">open_in_new</span>')
			.attr('data-url', link)
			.attr('data-noteId', s.note.pk)
			.attr('data-role', 'remote-open')
			.attr('title', tooltip)
			.prop('outerHTML');
	}else{
		if(s.for == 'create'){
			s.footerInfo = '新的笔记';
			s.enableDelete = false;
		}else if(s.note && s.note.object && s.note.object.lastUpdateTime){
			s.footerInfo = '上次保存于 '+timeUtils.dateTime(s.note.object.lastUpdateTime, '/', true);
			s.enableDelete = true;
		}
		if(cate.cates[s.noteType].hasMark){
			s.enableLocate = true;
		}else{
			s.enableLocate = false;
		}
	}

	return inst._state;
}

function getKeywordSuggestions(stores, info){
	return stores.noteItem.search({ url: urlUtils.getCurPageUrl(), searchScope: 'page' }, { project: { keywords: true } })
		.then(function(notes){
			if(!notes || !notes.result || !notes.result.length){
				return keywordService.getSuggestions(info).then(function(rs){
					if(rs && rs.result && rs.result.length){
						rs.result = rs.result.map(k => ({ pk: k.id, object: { keyword: k.name } }));
					}
					return rs;
				});
			}
			var m = {},
				kids = notes.result.forEach(n => (n.object.keywords || []).forEach(kid => m[kid] = (m[kid] || 0) + 1)),
				arr = [], k, t;

			for(k in m){
				if(m.hasOwnProperty(k)){
					arr.push({ 'pk': k, 'count': m[k] });
				}
			}

			t = Math.ceil(notes.result.length / 2);

			arr = arr.sort((a, b) => b.count > a.count);

			if(arr.some(k => k.count >= t)){
				arr = arr.filter(k => k.count >= t);
			}else{
				arr = arr.splice(0, 3);
			}

			arr = arr.map(i => i.pk);

			if(!arr.length){
				return null;
			}
			
			return stores.keyword.search({ '_id': arr }, { 'project': { keyword: true } });
		});
}

function setPositionTo(dom, pos, andThenShow){
	var self = this,
		s = self._state,
		magic, p;
	
	if(!dom || !pos){
		return;
	}

	if(!s.show){
		$(dom).css({ 'visibility': 'hidden' }).show();
		asap(calcPos);
		magic = true;
	}else{
		calcPos();
	}

	function calcPos(){
		if(!s.setMax && !s.setTop){
			switch(pos){
			case 'left-bottom':
				p = domPos.avoidOutOfClient(dom, {
					'clientX': Math.max(10 - window.pageXOffset, 0),
					'clientY': $(window).outerHeight() - dom.height()
				}, {
					'offsetX': 10,
					'offsetY': -20
				});

				break;
			case 'center-middle':
				p = domPos.avoidOutOfClient(dom, {
					'clientX': ($(window).outerWidth() - dom.width()) / 2,
					'clientY': ($(window).outerHeight() - dom.height()) / 2
				}, {
					'offsetX': 0,
					'offsetY': 0
				});
				break;
			default:
				return;
			}

			if(p){
				setPosition(dom, {
					'left': p.clientX,
					'bottom': $(window).outerHeight() - (p.clientY + dom.height())
				});
			}
		}

		if(magic && !andThenShow){
			$(dom).hide();
		}

		$(dom).css({ visibility: 'initial' });

		if(andThenShow){
			self._setState({ show: true }, true);
		}
	}
}
