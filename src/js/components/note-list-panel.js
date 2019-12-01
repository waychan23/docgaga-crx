"use strict";

const $ = require('jquery');
const SimpleEventEmitter = require('../base/simple-event-emitter'),
	  asap = require('../utils/asap'),
	  tmpls = require('../templates/note-list-panel-tmpl'),
	  makeMovable = require('../utils/dom-movable').makeMovable,
	  domInput = require('../utils/dom-input'),
	  cate = require('../model/note-category'),
	  timeUtils = require('../utils/time-utils'),
	  KeywordSelect = require('../widgets/keyword-select'),
	  auth = require('../utils/auth-utils'),
	  cr = require('../utils/chrome'),
	  debounce = require('lodash.debounce'),
	  keywordService = require('../services/keyword-service'),
	  Settings = require('../settings'),
	  preventDefaultAndStopPropagation = require('../utils/event-utils').preventDefaultAndStopPropagation;

module.exports = NoteListPanel;

const SETTING = Settings.DocGagaSettings.SETTING;

const settings = Settings();

const pages = {
	loginPage: 'oauth-login.html'
};

const defaultState = {
	'show': true,
	'tabs': (function(){
		var tabs = {};

		tabs[cate.tabId.TAB_MARK] = 0;
		tabs[cate.tabId.TAB_NOTE] = 0;
		tabs[cate.tabId.TAB_QUESTION] = 0;
		tabs[cate.tabId.TAB_ANCHOR] = 0;
			 
		return tabs;
	})(),
	'title': '汤圆笔记',
	'collapsed': true,
	'loading': false,
	'notes': [],
	'controlPanelCollapsed': true,
	'showFilter': true,
	'searchScope': 'page', //[page|site|all]
	'showAdvancedFilter': false,
	'searchStr': '',
	'keywords': [],
	'initLoad': true,
	'showTypeFilter': true,
	'selectedTabs': null,
	'showMenu': false
};

function NoteListPanel(opts){

	SimpleEventEmitter.call(this);

	var self = this,
		domMap = self._domMap = {},
		store = self.store = {},
		loading = false;

	store.noteItem = opts.store.noteItem;
	store.keyword = opts.store.keyword;

	function init(){
		self._state = parseState(self);

		initDom();
		initEvents();

		auth.getLoginUser().then(function(user){
			var state = {};
			if(user){
				state.login = user;
			}else{
				state.login = false;
			}
			self._setState(state, true);
		});
		self._render();

		settings.requireSettings([
			{ name: SETTING.AUTO_SEARCH_NOTE, value: false }
		]).then(function(rs){
			if(rs.success){
				self._setState({ ready: true });
			}
		});
	}

	function destroy(){
		self.clearHandlers();

		domMap._movableObject.destroy();

		domMap.keywordSelect.destroy();

		domMap.main.remove();

		domMap = self._domMap = {};

		self._state = null;
	}

	function initDom(){
		var t;

		domMap.parent = $(document.body);
		domMap.main = $(tmpls.main()).appendTo(domMap.parent);

		domMap.menu = domMap.main.find('.docgaga-note-list-menu');
		domMap.newNoteBtn = domMap.menu.find('.docgaga-note-list-menu-btn[data-role=new-note-btn]');

		domMap.header = domMap.main.find('.docgaga-note-list-header');
		domMap.toggleBtn = domMap.main.find('.docgaga-note-list-panel-toggle-btn');
		domMap.loginBtn = $(tmpls.loginBtn(cr.url(pages.loginPage)));
		
		domMap.footer = domMap.main.find('.docgaga-note-list-footer');

		domMap.refreshBtn = domMap.main.find('.docgaga-note-list-panel-refresh-btn');
		domMap.filter = domMap.main.find('.docgaga-note-list-filter');
		domMap.filterBtn = domMap.footer.find('a[data-role=filter]');
		domMap.toggleAdvancedFilterBtn = domMap.filter.find('a[data-role=toggle-advanced]');
		domMap.advancedFilter = domMap.filter.find('div[data-role=advanced-filter]');

		domMap.keywordSelectWrapper = domMap.advancedFilter.find('div[data-role=keyword-select-block] div[data-role=block-content]');

		domMap.keywordSelect = new KeywordSelect(domMap.keywordSelectWrapper, {
			'tip': '添加要查看的关键词',
			'editable': false
		});

		domMap.scopeSelect = domMap.filter.find('select[data-role=scope-select]');

		domMap.searchInput = domMap.filter.find('input[data-role=search-input]');

		domMap.footerInfo = domMap.main.find('.docgaga-note-list-footer-info');
		domMap.headerTitle = domMap.main.find('.docgaga-note-list-title');
		domMap.emptyInfo = domMap.main.find('.docgaga-note-list-empty-info');
		domMap.list = domMap.main.find('.docgaga-note-list');

		domMap.controlPanel = domMap.main.find('.docgaga-note-list-control-panel');
		domMap.tabs = domMap.main.find('.docgaga-note-list-tabs');
		domMap.controlPanelToggleBtn = domMap.main.find('.docgaga-note-list-control-panel-toggle-btn');

		for(t in self._state.tabs){
			if(self._state.tabs.hasOwnProperty(t)){
				if(cate.tabs[t].iconfont){
					$(tmpls.tab(cate.tabs[t])).appendTo(domMap.tabs)
						.find('img[data-role=icon]').hide()
						.siblings('span[data-role=icon]').show();
				}else{
					$(tmpls.tab(cate.tabs[t])).appendTo(domMap.tabs)
						.find('span[data-role=icon]').hide()
						.siblings('img[data-role=icon]').show();
				}
			}
		}

		domMap._movableObject = makeMovable(domMap.main, domMap.header, { 'inBoundry': true, 'transparent': true, 'cursor': 'move', 'useRight': true });
	}

	function initEvents(){
		domMap.main.on('mouseup', function(event){
			event.preventDefault();
			self.fireEvent('focus');
		});

		domMap.newNoteBtn.on('click', self.createNewNote.bind(self));

		domMap.header.on('mouseup', function(event){
			if(!self._state.initLoad){
				domMap.searchInput.focus();
			}
		});

		domMap.toggleBtn.on('click', self.toggle.bind(self));

		domMap.filterBtn.on('click', self.toggleFilter.bind(self));

		domMap.toggleAdvancedFilterBtn.on('click', self.toggleAdvancedFilter.bind(self));

		domMap.refreshBtn.on('click', self.refresh.bind(self));

		domMap.controlPanelToggleBtn.on('click', self.toggleControlPanel.bind(self));

		domMap.list.on('click', 'li', function(event){
			preventDefaultAndStopPropagation(event);

			self.fireEvent('note-open', {
				'dom': this,
				'note': this._note
			});
		});

		domMap.list.on('click', 'li a[data-role=remote-open]', function(event){
			preventDefaultAndStopPropagation(event);

			var target = $(event.currentTarget),
				noteId = $(target).attr('data-noteId'),
				url = $(target).attr('data-url');

			if(noteId && url){
				self.fireEvent('remote-note-open', {
					url: url,
					noteId: noteId
				});
			}

			event.stopPropagation();
		});

		domMap.tabs.on('dblclick click', 'li', debounce(function(event){
			preventDefaultAndStopPropagation(event);

			var target = $(event.currentTarget),
				tabId = target.attr('data-id'),
				state = {},
				s = self._state,
				t, c, h, o;

			if(event.type == 'click' && tabId){
				state.selectedTabs = $.extend({}, s.selectedTabs);

				if(state.selectedTabs[tabId]){
					delete state.selectedTabs[tabId];
				}else{
					state.selectedTabs[tabId] = true;
				}
			}else if(event.type == 'dblclick' && tabId){
				state.selectedTabs = {};

				c = 0;
				h = 0;

				for(t in s.tabs){
					if(s.tabs.hasOwnProperty(t)){
						if(s.selectedTabs[t]){
							h ++;
						}
						c ++;
					}
				}

				if(!s.selectedTabs[tabId] && (c - h) > 1 || s.selectedTabs[tabId] && h > 1){
					state.selectedTabs[tabId] = true;
					o = false;
				}else{
					state.selectedTabs[tabId] = !s.selectedTabs[tabId];
					o = !state.selectedTabs[tabId];
				}

				for(t in s.tabs){
					if(s.tabs.hasOwnProperty(t) && t != tabId){
						state.selectedTabs[t] = o;
					}
				}
			}

			self._setState(state, true);
			self.refresh();
		}, 200));

		domMap.list.on('click', 'li .docgaga-note-list-item-delete-btn', function(event){
			preventDefaultAndStopPropagation(event);

			var pk = $(event.target).attr('data-pk');

			if(/^\d+$/.test(''+pk)){
				pk = parseInt(pk);
			}

			if(pk && confirm('确定要删除这条记录？')){
				self.deleteNote(pk);
			}

			event.stopPropagation();
			event.preventDefault();
		});

		domMap._movableObject.on('drag-start', function(){
			self._skipToggle = true;

			var state = {};

			state.moving = true;
			state.showMenu = false;

			self._setState(state, true);
		});

		domMap._movableObject.on('drag-end', function(){
			var state = {};

			state.moving = false;
			state.showMenu = true;

			self._setState(state, true);
		});

		domMap.keywordSelect.on('load-cands', loadKeywordCands.bind(self));
		domMap.keywordSelect.on('change', function(event){
			
			var state = {};

			state.keywords = domMap.keywordSelect.getSelectedKeywords();

			self._setState(state, true);
			self.refresh();
		});
		domMap.scopeSelect.on('change', function(event){
			var state = {};

			state.searchScope = domMap.scopeSelect.val();
			
			self._setState(state, true);
			self.refresh();
		});

		domMap.emptyInfo.on('click', '.docgaga-info-link[data-role=load-note-btn]', function(evt){
			preventDefaultAndStopPropagation(evt);
			self.refresh();
		});

		domMap.emptyInfo.on('click', '.docgaga-info-link[data-role=switch-scope-btn]', function(evt){
			preventDefaultAndStopPropagation(evt);
			var scope = $(evt.target).data('scope');
			if(!scope == 'site' || !scope == 'all' || scope == self._state.searchScope){
				return;
			}
			domMap.scopeSelect.val(scope);			
			self._setState({ searchScope: scope });
			self.refresh();
		});

		domInput(domMap.searchInput).onInput(function(event){
			var state = {};

			state.searchStr = domMap.searchInput.val();

			self._setState(state, true);
			self.refresh();
		});

	}

	auth.onChanged(function(user){
		if(self._state){//check if launched
			
			if(self._state.login && self._state.login.username && self._state.login.username === user.username){
				return;
			}
			var state = {};
			state.login = user;

			self._setState(state, true);
			self.refresh();
		}
	});

	self.bootstrap = init;
	self.destroy = destroy;
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
		pagination: { pageNo: 1, pageSize: 100 }
	}).then(function(rs){
		if(!rs || !rs.result){
			return [];
		}

		return rs.result;
	});
}

NoteListPanel.prototype = Object.create(SimpleEventEmitter.prototype);

NoteListPanel.prototype.blink = function(){
};

NoteListPanel.prototype.createNewNote = function(){
	var self = this;
	self.fireEvent('create-note');
}

NoteListPanel.prototype.starPage = function(){
	var self = this;
	self.fireEvent('star-page');
}

NoteListPanel.prototype.show = function(){
	var self = this;

	self._setState({ 'show': true }, true);
};

NoteListPanel.prototype.hide = function(){
	var self = this;

	self._setState({ 'show': false }, true);
};

NoteListPanel.prototype.toggle = function(uncollapsed){
	var self = this,
		state = {};

	if(self._skipToggle){
		self._skipToggle = false;
		return;
	}

	if(uncollapsed !== true || uncollapsed !== false){
		state.collapsed = !self._state.collapsed;
	}else{
		state.collapsed = !uncollapsed;
	}

	self._setState(state, true);

	if(!self._state.collapsed){
		settings.requireSettings([ { name: SETTING.REFRESH_ON_OPEN, value: true } ]).then(function(rs){
			if(rs.success){
				if(!self._state.collapsed){
					self.refresh();
				}
			}
		});
	}
};

NoteListPanel.prototype.toggleFilter = function(){
	var self = this,
		state = {};

	state.showFilter = !self._state.showFilter;
	
	self._setState(state, true);
};

NoteListPanel.prototype.toggleAdvancedFilter = function(){
	var self = this,
		state = {};

	state.showAdvancedFilter = !self._state.showAdvancedFilter;

	self._setState(state, true);
};

NoteListPanel.prototype.toggleControlPanel = function(){
	var self = this,
		state = {};

	state.controlPanelCollapsed = !self._state.controlPanelCollapsed;

	self._setState(state, true);
};

NoteListPanel.prototype.loadNotes = function(){
	var self = this,
		s = self._state,
		state = {},
		store = self.store.noteItem,
		pairs = [],
		nextNotesLoadTime = new Date().getTime(),
		isStale = false,
		prom, str, kws, m, reload, query, qopts;

	state.loading = true;
	state.nextNotesLoadTime = nextNotesLoadTime;
	
	self._setState(state, true);

	state = {};

	m = {};
	str = s.searchStr.trim();
	kws = s.keywords.map(function(k){
		return k.pk;
	});
	
	query = {
		'searchStr': str,
		'searchScope': s.searchScope,
		'keywords': kws,
		'url': window.location.href
	};

	qopts = {
		pagination: { pageNo: 1, pageSize: 60 },
		project: { startPath: 0, endPath: 0, startOffset: 0, endOffset: 0 },
		sort: [ [ 'lastUpdateTime', -1 ] ]
	};

	prom = store.search(query, qopts);

	prom.then(function(result){
		result = result && result.result;

		if(self._state.nextNotesLoadTime && self._state.nextNotesLoadTime > nextNotesLoadTime){
			isStale = true;
			return;
		}
		
		if(self._state.initLoad && (!result || !result.length) && self._state.searchScope != 'all'){
			return settings.requireSettings([ 
				{ name: SETTING.EXPAND_SEARCH_SCOPE_TO, value: (scope) => scope != 'none' }
			]).then(function(rs){
				var curScope = self._state.searchScope,
					maxScope;
				if(rs.success){
					maxScope = rs.result.get(SETTING.EXPAND_SEARCH_SCOPE_TO);
					if(curScope == 'page'){
						reload = true;
						state.searchScope = 'site'
					}else if(curScope == 'site' && maxScope == 'all'){
						reload = true;
						state.searchScope = 'all';
					}
				}else{
					reload = false;
				}
			});
		}

		state.notes = (result || []).map(function(note){
			var title,
				text = '', noteText = '';

			if(note.object.note){
				noteText = note.object.note.trim().split(/\r?\n/)[0] || '';
			}
			if(note.object.text){
				text = note.object.text.trim().split(/\r?\n/)[0] || '';
			}

			title = noteText || text || '';

			return {
				'pk': note.pk,
				'range': note.range,
				'inCurPage': note.inCurPage,
				'inCurSite': note.inCurSite,
				'title': title,
				'object': {
					'note': noteText,
					'text': text,
					'url': note.object.url,
					'pageTitle': note.object.pageTitle,
					'keywords': note.object.keywords || [],
					'noteType': note.object.noteType,
					'lastUpdateTime': note.object.lastUpdateTime,
					'keywordNames': note.object.keywordNames
				}
			};
		});

		if(self._state.initLoad && self._state.searchScope == 'page' && state.notes.length && self._state.collapsed){
			settings.requireSettings([ { name: SETTING.AUTO_OPEN_WHEN_NOTE_FOUND, value: true } ]).then(function(rs){
				if(rs.success){
					self._setState({ collapsed: false, ready: true }, true);
				}
			});
		}

	}).catch(function(error){
		state.loading = false;
		console.error(error, error == '汤圆笔记未登录');
		if(error == '未登录'){
			state.title = defaultState.title + ' - 登录';
		}
	}).then(function(){
		var ready = self._state.ready;

		state.loading = false;
		state.initLoad = (self._state.initLoad && self._state.searchScope == 'all' || !reload)?false: true;
		if(!ready && !reload){
			state.ready = true;
		}
		self._setState(state, true);

		if(reload || self._state.pendingLoad){
			self._state.pendingLoad = false;
			settings.requireSettings([ { name: SETTING.REFRESH_ON_OPEN, value: true } ]).then(function(rs){
				if(!rs.success || !self._state.collapsed){
					setTimeout(function(){
						self.refresh();
					});
				}
			});
		}
	});
};

NoteListPanel.prototype.checkReady = function(){
	var self = this;
	return self._state.ready? 
			Promise.resolve({ ready: true }):
			new Promise(function(resolve, reject){
				var timer;
				self.on('ready', function(){
					if(timer){
						clearTimeout(timer);
						resolve({ ready: true });
					}
				});
				
				timer = setTimeout(function(){
					resolve({ error: 'timeout' });
				}, 3000);
			});
};

NoteListPanel.prototype.refresh = debounce(function(){
	var self = this,
		s = self._state,
		state;

	if(!s.show){
		return;
	}

	state = {};

	if(s.loading){
		s.pendingLoad = true;
	}else{
		auth.getLoginUser().then(function(user){
			if(!user){
				state.login = false;
			}else{
				state.login = user;
				self.loadNotes();
			}
			self._setState(state, true);
		});
	}
}, 300);

NoteListPanel.prototype.deleteNote = function(pk){
	if(!pk){
		return Promise.reject('illegal primary key specified');
	}
	
	var self = this,
		state = {},
		store = self.store.noteItem,
		domMap = self._domMap;

	return store.delete(pk).then(function(){
		console.log('删除成功');
		state.notes = self._state.notes.filter(function(note){
			return note.pk != pk;
		});
	}).catch(function(error){
		console.error(error);
		alert('删除失败');
	}).then(function(){
		self.fireEvent('delete-success', { 'pk': pk });
		self._setState(state, true);
	});
};

NoteListPanel.prototype.getZIndex = function(){
	var self = this,
		domMap = self._domMap,
		zIndex;

	zIndex = parseInt(domMap.main.css('z-index'));

	if(!isNaN(zIndex)){
		return zIndex;
	}

	return null;
};

NoteListPanel.prototype.setZIndex = function(zindex){
	if(isNaN(parseInt(zindex))){
		return;
	}

	var self = this,
		domMap = self._domMap;

	domMap.main.css('z-index', zindex);
};

NoteListPanel.prototype._render = function(changed){
	var self = this,
		domMap = self._domMap,
		s = self._state,
		l, ll, lis, t, n, tid, sCates;

	if(!changed || changed.login){
		changed && (changed.title = true);

		if(s.login){
			s.title = s.login.username + ' 的笔记';
		}else{
			s.title = defaultState.title;

		}
	}

	if(!changed || changed.title){
		domMap.headerTitle.text(s.title);

		if(s.login){
			domMap.loginBtn.remove();
		}else{
			domMap.loginBtn.appendTo(domMap.headerTitle)
				.on('click', function(event){
					cr.openTab($(this).attr('href'), null, false);
					event.preventDefault();
					return false;
				});
		}
	}

	if(!changed || changed.collapsed){
		if(s.collapsed){
			domMap.header.siblings().css('display', 'none');
			domMap.main.addClass('docgaga-note-list-panel-collapsed');
			domMap.toggleBtn.text('记');
			domMap.toggleBtn.attr('title', '汤圆笔记');
		}else{
			domMap.header.siblings().css('display', 'block');
			domMap.main.removeClass('docgaga-note-list-panel-collapsed');
			domMap.toggleBtn.text('keyboard_arrow_right');
			domMap.toggleBtn.attr('title', '隐藏');
			if(!s.initLoad){
				domMap.searchInput.focus();
			}
		}
	}

	if(s.showMenu){
		domMap.menu.show();
	}else{
		domMap.menu.hide();
	}

	if(!changed || changed.loading){
		if(s.loading){
			domMap.main.addClass('docgaga-note-list-panel-empty');
			domMap.emptyInfo.text('加载笔记中...');
			domMap.footerInfo.text('共有...条笔记');
		}else{
			domMap.footerInfo.text('共有 '+s.notes.length+' 条笔记');
		}
	}

	if(!s.loading){
		domMap.footerInfo.text('共有'+s.notes.length+'条笔记');
	}

	if(!s.notes.length){
		domMap.main.addClass('docgaga-note-list-panel-empty');
		if(s.login){
			if(s.loading){
				domMap.emptyInfo.hide().removeClass('docgaga-note-list-empty-info-small-text').text('笔记加载中...').show();
			}else if(s.initLoad && s.searchScope == 'page'){
				domMap.emptyInfo.hide().addClass('docgaga-note-list-empty-info-small-text').html(
					'<span class="docgaga-info-line">未开启自动获取笔记(<a class="docgaga-info-link" target="_blank" href="'+cr.url('settings.html')+'">去开启</a>)</span> \
					 <span class="docgaga-info-line"><a class="docgaga-info-link" data-role="load-note-btn">点击这里获取笔记</a></span> \
					'
				).show();
			}else{//no notes
				if(s.searchScope == 'page'){
					domMap.emptyInfo.hide().addClass('docgaga-note-list-empty-info-small-text').html(
						'<span class="docgaga-info-line">当前页面没有记过的笔记</span> \
						 <span class="docgaga-info-line"><a class="docgaga-info-link" data-role="switch-scope-btn" data-scope="site">查找该网站上记过的笔记</a></span> \
						 <span class="docgaga-info-line"><a class="docgaga-info-link" data-role="switch-scope-btn" data-scope="all">查找所有地方记过的笔记</a></span> \
						'
					).show();
				}else if(s.searchScope == 'site'){
					domMap.emptyInfo.hide().addClass('docgaga-note-list-empty-info-small-text').html(
						'<span class="docgaga-info-line">当前网站没有记过的笔记</span> \
						 <span class="docgaga-info-line"><a class="docgaga-info-link" data-role="switch-scope-btn" data-scope="all">查找所有地方记过的笔记</a></span> \
						'
					).show();
				}else{
					domMap.emptyInfo.hide().removeClass('docgaga-note-list-empty-info-small-text').text('暂无笔记').show();
				}
			}
		}else{
			domMap.emptyInfo.text('请先登录');
		}
	}else{
		domMap.main.removeClass('docgaga-note-list-panel-empty');
		domMap.emptyInfo.text('');
	}

	if(!changed || changed.notes){
		if(changed && changed.notes){
			lis = {};

			domMap.list.find('.docgaga-note-list-item').each(function(index, i){
				i = $(i);

				var pk = i.attr('data-pk'),
					n, removed, t, extLink;

				if(changed.notes.remove[pk]){
					removed = true;
					i.remove();
				}else if(changed.notes.modify[pk]){
					n = changed.notes.modify[pk];

					i.find('.docgaga-note-list-item-title')
						.attr('title', getListItemTitleTooltip(n))
						.find('span[data-role=text]').text(n.title);

					i.find('div[data-role=keywords]')
//						.attr('title', '关键词: ' + n.object.keywordNames)
						.text(n.object.keywordNames.replace(/,/g, ' | '));
					
					if(cate.cates[n.object.noteType].iconfont){
						i.find('img[data-role=icon]').attr('src', '').hide();
						i.find('span[data-role=icon]')
							.text(cate.cates[n.object.noteType].iconfont)
							.attr('data-type', n.object.noteType)
							.attr('title', cate.cates[n.object.noteType].name)
							.show();
					}else{
						i.find('span[data-role=icon]').data('type', '').text('').hide();
						i.find('img[data-role=icon]')
							.attr('src', chrome.extension.getURL(cate.cates[n.object.noteType].icon))
							.attr('data-type', n.object.noteType)
							.attr('title', cate.cates[n.object.noteType].name)
							.show();
					}

					extLink = !n.inCurPage? makeExtLink(n): null;

					if(n.inCurPage){
						// i.find('div[data-role=extra-info]').text('来自本页面');
						i.find('div[data-role=extra-info]').text('');
					}else if(extLink){
						i.find('div[data-role=extra-info]').html(extLink);
					}else{
						i.find('div[data-role=extra-info]').text('');
					}

					i[0]._note = n;

					i.prependTo(domMap.list);
				}
				if(!removed){
					n = i[0]._note;
					lis[n.pk] = i;
					asap(function(){
						t = timeUtils.dateTime(n.object.lastUpdateTime, '/', true);
						$(i).find('div[data-role=last-update-time]')
							.text(timeUtils.since(n.object.lastUpdateTime, '/', true))
							.attr('title', '更新于 '+t);
					});
				}
			});

			changed.notes.add.sort((a, b) => a.object.lastUpdateTime.getTime() - b.object.lastUpdateTime.getTime())
				.forEach(function(note){
					var icon = chrome.extension.getURL(cate.cates[note.object.noteType].icon),
						extLink = (s.searchScope == 'all' || s.searchScope == 'site') && !note.inCurPage? makeExtLink(note): null,
						dom = $(tmpls.listItem(note.pk,
											   { 'text': note.title || '', 'tooltip': getListItemTitleTooltip(note) },
											   { 'type': note.object.noteType, 'icon': icon, iconfont: cate.cates[note.object.noteType].iconfont, 'title': cate.cates[note.object.noteType].name },
											   { 'time': '更新于 '+timeUtils.dateTime(note.object.lastUpdateTime, '/', true), 'timeStr': timeUtils.since(note.object.lastUpdateTime, '/', true) },
											//    { 'text': extLink || '来自本页面' },
											   { 'text': extLink || '' },
											   note.object.keywordNames.split(',')
											  ));

					dom[0]._note = note;

					lis[note.pk] = dom;
//					dom.prependTo(domMap.list);

					return dom;
				});
			

			lis = s.notes.map(function(n){
				return lis[n.pk];
			}).filter(Boolean);

			domMap.list.empty();

			lis.forEach(function(n){
				$(n).find('*[data-role=icon]').hide();
				if($(n).find('span[data-role=icon]').length){
					$(n).find('span[data-role=icon]').show();
				}else{
					$(n).find('img[data-role=icon]').show();
				}
				domMap.list.append(n);
			});
		}
	}

	if(!changed || changed.controlPanelCollapsed){
		if(s.controlPanelCollapsed){
			domMap.controlPanel.addClass('docgaga-note-list-control-panel-collapsed');
			domMap.controlPanelToggleBtn.text('expand_more');
		}else{
			domMap.controlPanel.removeClass('docgaga-note-list-control-panel-collapsed');
			domMap.controlPanelToggleBtn.text('expand_less');
		}
	}

	if(true){
		l = [];
		domMap.tabs.find('li').each(function(index, i){
			i = $(i);

			var tabId = i.attr('data-id');

			l.push({ 'dom': i, 'count': s.tabs[tabId] });

			i.find('span[data-role=count]').text(s.tabs[tabId]);
			
			if(s.selectedTabs[tabId]){
				i.addClass('docgaga-note-list-tab-selected');
			}else{
				i.removeClass('docgaga-note-list-tab-selected');
			}

			i.remove();
		});

		l.sort(function(a, b){
			return b.count - a.count;
		}).forEach(function(i){
			i.dom.appendTo(domMap.tabs);
		});
	}

	if(!changed || changed.selectedTabs || true){
		sCates = {};

		for(tid in s.selectedTabs){
			if(s.selectedTabs.hasOwnProperty(tid)){
				t = s.selectedTabs[tid] && cate.tabs[tid];
				t && t.cates.forEach(c => sCates[c] = true);
			}
		}

		domMap.list.find('li.docgaga-note-list-item').each(function(index, li){
			var item = li._note;

			if(sCates[item.object.noteType]){
				$(li).show();
			}else{
				$(li).hide();
			}
		});
	}

	if(!changed || changed.showAdvancedFilter){
		if(s.showAdvancedFilter){
			domMap.advancedFilter.show();
			domMap.toggleAdvancedFilterBtn
				.attr('data-active', 'true')
				.attr('title', '隐藏高级设置')
				.text('keyboard_arrow_down');
			domMap.keywordSelect.updateView();
		}else{
			domMap.advancedFilter.hide();
			domMap.toggleAdvancedFilterBtn
				.attr('data-active', 'false')
				.attr('title', '显示高级设置')
				.text('keyboard_arrow_up');
			if(!s.initLoad){
				domMap.searchInput.focus();
			}
		}
	}

	if(!changed || changed.showFilter){
		if(s.showFilter){
			domMap.filter.show();
			domMap.filterBtn.addClass('docgaga-note-list-footer-btn-active')
				.attr('title', '隐藏筛选设置');
			domMap.keywordSelect.updateView();
			if(!s.initLoad){
				domMap.searchInput.focus();
			}
		}else{
			domMap.filter.hide();
			domMap.filterBtn.removeClass('docgaga-note-list-footer-btn-active')
				.attr('title', '筛选设置');
		}
	}

	if(!changed || changed.searchScope){
		if(s.searchScope){
			domMap.scopeSelect.val(s.searchScope);
		}
	}

	if(!changed || changed.show){
		if(s.show){
			domMap.main.show();
			if(s.showFilter && s.showAdvancedFilter){
				domMap.keywordSelect.updateView();
			}
		}else{
			domMap.main.hide();
		}
	}

	if(!changed || changed.notes){
		lis = [];
		ll = {};
		l = [];

		if(changed && changed.notes){
			lis = lis.concat(changed.notes.add);
			for(t in changed.notes.modify){
				if(changed.notes.modify.hasOwnProperty(t)){
					lis.push(changed.notes.modify[t]);
				}
			}
		}else{
			lis = lis.concat(s.notes);
		}

		lis.filter(n => n.inCurPage).forEach(function(n){
			var kws = n.object.keywords,
				kwns = n.object.keywordNames.split(','),
				arr = [],
				i;

			for(i=0;i<Math.min(kws.length, kwns.length);i++){
				arr.push({ id: kws[i], name: kwns[i] });
			}

			arr.forEach(function(k){
				var n = k.name;
				if(!ll[n]){
					ll[n] = { count: 1, name: n, id: k.id };
					l.push(ll[n]);
				}else{
					ll[n].count += 1;
				}
			});
		});

		if(l.length){
			keywordService.updateKeywordCache(l);
		}
	}

	if(changed && changed.ready){
		if(s.ready){
			self.fireEvent('ready');
		}
	}
};

NoteListPanel.prototype._setState = function(state, render){
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

function parseState(self){
	var s = self._state,
		noteTypes = {},
		t;

	if(!s){
		self._state = s = $.extend({}, defaultState);
	}

	s.title = s.title || '';

	for(t in s.tabs){
		if(s.tabs.hasOwnProperty(t)){
			s.tabs[t] = 0;
		}
	}

	if(!s.login){
		s.notes = [];
	}

	s.notes.forEach(function(note){
		var tab = cate.cateTab[note.object.noteType];
		if(tab){
			s.tabs[tab.id] += 1 ;
		}
	});

	s.notes.sort(function(n1, n2){
		if(Boolean(n1.inCurPage) != Boolean(n2.inCurPage)){
			return n1.inCurPage?-1:1;
		}
		return n2.object.lastUpdateTime.getTime() - n1.object.lastUpdateTime.getTime();
	});

	s.selectedTabs = s.selectedTabs || (function(){
		var sTabs = {};

		for(var t in s.tabs){
			if(s.tabs.hasOwnProperty(t)){
				sTabs[t] = true;
			}
		}

		return sTabs;
	}());

	if(!s.moving){
		if(s.collapsed){
			s.showMenu = false;
		}else{
			s.showMenu = true;
		}
	}else{
		s.showMenu = false;
	}

	return s;
}

function diffState(oldState, newState){
	var prop,
		changed = {},
		o, i, n, pk;

	for(prop in newState){
		if(newState.hasOwnProperty(prop) && prop != 'notes' && oldState[prop] != newState[prop]){
			changed[prop] = true;
		}
	}

	changed.notes = {
		'add': [],
		'remove': {},
		'modify': {},
		'order': false
	};

	o = {};
	n = {};

	oldState.notes.forEach(function(i){
		o[i.pk] = i;
	});

	newState.notes.forEach(function(i){
		n[i.pk] = i;
	});

	for(i=0;i<Math.min(oldState.notes.length, newState.notes.length);i++){
		if(newState.notes[i].pk != oldState.notes[i].pk){
			changed.notes.order = true;
			break;
		}
	}

	for(pk in n){
		if(n.hasOwnProperty(pk)){
			if(!o[pk]){
				changed.notes.add.push(n[pk]);
			}else if(n[pk].object.lastUpdateTime.getTime() > o[pk].object.lastUpdateTime.getTime() ||
						n[pk].inCurPage != o[pk].inCurPage ||
						n[pk].inCurSite != o[pk].inCurSite){
				changed.notes.modify[pk+''] = n[pk];
			}
		}
	}
	for(pk in o){
		if(o.hasOwnProperty(pk)){
			if(!n[pk]){
				changed.notes.remove[pk+''] = true;
			}
		}
	}

	changed.notes.add.sort(function(a, b){
		return b.object.lastUpdateTime.getTime() - a.object.lastUpdateTime.getTime();
	});

	changed.notes.sort = changed.notes.add.length > 0 || changed.notes.sort;

	return changed;
}

function getListItemTitleTooltip(n){
	var text = n.object.text,
		note = n.object.note,
		str = '';

	if(text){
		str += '标记摘要：' + text;
	}
	
	if(note){
		str += text?'\n': '';
		str += '笔记摘要：' + note;
	}

	return str;
}

function makeExtLink(n){
	var link, title, name = '';

	if(n && n.object && n.object.url){
		link = 'http://'+n.object.url;
		
		if(n.inCurSite){
			// name = '来自本站';
			name = '';
			title = '该笔记来自本网站';
		}else{
			// name = '来自其他网站';
			name = '';
			title = '该笔记来自其他网站';
		}
		title += '\n- ' + n.object.pageTitle || '';

		if(title){
			title = title + '\n- ' + link;
		}else{
			title = link;
		}
		
		return tmpls.extLink(link, n, title, name);
	}

	return null;
}
