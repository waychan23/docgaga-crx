const timeUtils = require('../utils/time-utils');

/**
 笔记类型：
 1. 标注（有/无笔记/有选区）
 2. 疑问（有/无笔记/有选区）
 3. 质疑（有/无笔记/有选区）
 4. 位置（有/无笔记/有选区）
 5. 翻译（有笔记/有选区）
 6. 笔记（有笔记/无选区）
**/

var cates = {
	'CATEGORY_MARK': 'c_m', //category_note_mark_note
	'CATEGORY_NOTE': 'c_n', //category_note_note
	'CATEGORY_QUESTION': 'c_q', //category_note_question
//	'CATEGORY_TRANSLATION': 'c_t', //category_note_translation
//	'CATEGORY_DISAGREE': 'c_d', //category_note_disagree
	'CATEGORY_ANCHOR': 'c_a' //category_mark_anchor
};

var tabs = {
	'TAB_MARK': 't_m', //tab_mark
	'TAB_NOTE': 't_n', //tab_note
	'TAB_QUESTION': 't_q', //tab_question
//	'TAB_TRANSLATION': 't_t', //tab_translation
//	'TAB_DISAGREE': 't_d', //tab_disagree
	'TAB_ANCHOR': 't_a' //tab_anchor
};

var noteCategories = [
	{ id: cates.CATEGORY_NOTE, name: '笔记', hasMark: false,//1
	  editable: true, smallIcon: null, icon: 'img/icons/document.png',
	  iconfont: 'note',
	  contentName: '笔记',
	  desc: '记下灵感与想法',
	  title: function(item){ return item && item.note || ''; },
	  tooltip: function(item){ return item && item.note || ''; }
	},
	{ id: cates.CATEGORY_MARK, name: '标注', hasMark: true,//2
	  editable: true, smallIcon: null, icon: 'img/icons/favorite.png',
	  iconfont: 'lightbulb_outline',
	  contentName: '标注内容',
	  desc: '记下对标记内容的看法',
	  title: function(item){ return item && item.note || ''; },
	  tooltip: function(item){ return item && item.note || ''; }
	},
	{ id: cates.CATEGORY_QUESTION, name: '疑问', hasMark: true,//3
	  editable: true, smallIcon: null, icon: 'img/icons/help-blue-button.png',
	  contentName: '问题',
	  iconfont: 'help_outline',
	  desc: '记下对标记内容的疑问',
	  title: function(item){ return item && item.note || ''; },
	  tooltip: function(item){ return item && item.note || ''; }
	}/*,
	{ id: cates.CATEGORY_TRANSLATION, name: '翻译', hasMark: true,//4
	  editable: true, smallIcon: null, icon: 'img/icons/transfer-document.png',
	  iconfont: 'translate',
	  contentName: '译文',
	  desc: '记下对标记内容的翻译',
	  title: function(item){ return item && item.note || ''; },
	  tooltip: function(item){ return item && item.note || ''; }
	},
	{ id: cates.CATEGORY_DISAGREE, name: '质疑', hasMark: true,//5
	  editable: true, smallIcon: null, icon: 'img/icons/red-ball.png',
	  iconfont: 'face',
	  contentName: '理由',
	  desc: '对标记的内容表示质疑，记下理由',
	  title: function(item){ return item && item.note || ''; },
	  tooltip: function(item){ return item && item.note || ''; }
	}*/,
	{ id: cates.CATEGORY_ANCHOR, name: '位置', hasMark: true,//6
	  contentName: '位置说明',
	  desc: '标记这个位置，方便下次查找',
	  iconfont: 'content_paste',
	  editable: true, smallIcon: null, icon: 'img/icons/internet-history.png',
	  title: function (item){ return { 'title': item.text, 'time': getAnchorTitleTime(item) }; },
	  tooltip: function(item){ return { 'title': item.text, 'time': item.lastUpdateTime || item.createTime || '-' }; }
	}
];

var knownCates = (function(){
	var map = {},
		order = 0;

	noteCategories.forEach(function(cate){
		cate.order = order++;
		map[cate.id] = cate;
/*
		cate.subCategories && cate.subCategories.forEach(function(sCate){
			map[sCate.id] = sCate;
			sCate.parent = cate;
		});
*/
	});
	return map;
})();

var noteListTabs = [
	{
		'id': tabs.TAB_MARK,
		'name': '标记',
		'smallIcon': null, 'icon': 'img/icons/favorite.png',
		'cates': [ cates.CATEGORY_MARK ],
		'iconfont': knownCates[cates.CATEGORY_MARK].iconfont
	},
	{
		'id': tabs.TAB_NOTE,
		'name': '笔记',
		'smallIcon': null, 'icon': 'img/icons/write-document.png',
		'cates': [ cates.CATEGORY_NOTE ],
		'iconfont': knownCates[cates.CATEGORY_NOTE].iconfont
	},
	{
		'id': tabs.TAB_QUESTION,
		'name': '疑问',
		'smallIcon': null, 'icon': 'img/icons/help-blue-button.png',
		'cates': [ cates.CATEGORY_QUESTION ],
		'iconfont': knownCates[cates.CATEGORY_QUESTION].iconfont
	}/*,
	{
		'id': tabs.TAB_TRANSLATION,
		'name': '翻译',
		'smallIcon': null, 'icon': 'img/icons/transfer-document.png',
		'cates': [ cates.CATEGORY_TRANSLATION ],
		'iconfont': knownCates[cates.CATEGORY_TRANSLATION].iconfont
	}*/,
	{
		'id': tabs.TAB_ANCHOR,
		'name': '阅读位置',
		'smallIcon': null, 'icon': 'img/icons/internet-history.png',
		'cates': [ cates.CATEGORY_ANCHOR ],
		'iconfont': knownCates[cates.CATEGORY_ANCHOR].iconfont
	}/*,
	{
		'id': tabs.TAB_DISAGREE,
		'name': '质疑',
		'smallIcon': null, 'icon': 'img/icons/red-ball.png',
		'cates': [ cates.CATEGORY_DISAGREE ],
		'iconfont': knownCates[cates.CATEGORY_DISAGREE].iconfont
	}*/
];

var cateTabMap = (function(){
	var map = {};

	noteListTabs.forEach(function(tab){
		tab.cates.forEach(function(cateId){
			map[cateId] = tab;
		});
	});

	return map;
}());

var tabMap = (function(){
	var map = {},
		order = 0;

	noteListTabs.forEach(function(tab){
		tab.order = order++;
		map[tab.id] = tab;
	});

	return map;
}());

function getAnchorTitleTime(item){
	if(!item){
		return '';
	}
	return timeUtils.since(item.lastUpdateTime || item.createTime || null);
}

module.exports.cateId = cates;
module.exports.cates = knownCates;
module.exports.tabs = tabMap;
module.exports.tabId = tabs;
module.exports.cateTab = cateTabMap;
