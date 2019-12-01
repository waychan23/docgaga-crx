"use strict";

const urlUtils = require('../utils/url-utils'),
	  keywordStore = require('../storage/keyword-server-store')();

const INIT_FETCH_COUNT = 300;
const MAX_PAGE_SIZE = 100;

const PREP_EN = [
	'it', 'a', 'that', 'true', 'about', 'of', 'for', 'in', 'on', 'at', 'from', 'over', 'yes', 'no', 'is', 'there', 'here', 'i', 'am', 'are', 'were', 'was', 'its', 'my', 'he', 'his', 'she', 'her', 'your', 'their', 'to', 'and', 'or', 'not', 'no', 'do', 'so', 'why', 'where', 'what', 'which', 'who', 'whose', 'don\'t', 'won\'t', 'doesn\'t', 'should', 'should\'t', 'would', 'wouldn\'t'
];

const PREP_CN = [
	'会不会', '为什么', '能不能', '行不行', '可以', '什么', '怎么', '不能', '不要', '允许', '你的', '我的', '他的', '如果', '那么', '就会', '将会', '谁', '的', '是', '你', '我', '他', '她', '它', '不', '在'
];

const REG_LETTER_NUM_COMB = /([A-z0-9]+)/g,
	  REG_PUNCTS_EN = /[,\.\?;'"\{\}\[\]\|\\\/~`\!@#\$%\^&\*\(\)\-\_\+=]+/g,
	  REG_PUNCTS_CN = /[，。？；『』【】、～！…—（）：]+/g,
	  REG_LINE = /[\r\n]+/g,
	  REG_SPACE = /[\s\t]+/g,
	  REG_PURE_NUM = /^[0-9]+$/g,
	  REG_NON_EN = /[^A-z0-9\s\-\_]+/,
	  REG_PREP_EN = (function(){
		  var str = '\\s+[(';
		  str += PREP_EN.join('|');
		  str += ')]\\s+';
		  return RegExp(str, 'ig');
	  }()),
	  REG_PREP_CN = (function(){
		  var str = '[(';
		  str += PREP_CN.join('|');
		  str += ')]';
		  return RegExp(str, 'ig');
	  })();

var keywordNameMap = {};
var keywordIdMap = {};
var nonEnWords = [];
var inited = false;

module.exports.queryByIds = function(obj){
	if(!obj || !obj.ids || !obj.ids.length){
		return [];
	}

	var arr = [], failed = [], m = {},
		i, id, kw;

	obj.ids = [].concat(obj.ids).filter(Boolean);

	for(i=0;i<obj.ids.length;i++){
		id = obj.ids[i];
		kw = keywordIdMap[id];
		if(keywordIdMap[id]){
			m[id] = { pk: kw.id, object: { keyword: kw.name } };
			arr.push(m[id]);
		}else{
			failed.push(id);
		}
	}

	if(!failed.length){
		return Promise.resolve(arr);
	}

	return keywordStore.search({ '_id': failed }, { project: { keyword: true } }).then(function(rs){
		if(!rs || !rs.result || !rs.result.length){
			return [];
		}

		rs.result.forEach(kw => m[kw.pk] = kw);

		arr = obj.ids.map(id => m[id]).filter(Boolean);

		updateCache(null, null, rs.result.map(kw => ({ id: kw.pk, name: kw.object.keyword, count: 1 })));

		return arr;
	});
};

module.exports.getSuggestions = function(obj){
	if(!obj || !obj.url){
		throw "not enough info";
	}

	var rs;

	return makeSuggestions(obj.url || '', obj.pageTitle || '', obj.text || '', obj.note || '');
};

module.exports.updateCache = function(obj){
	if(!obj || !obj.url || !obj.keywords || !obj.keywords.length){
		throw "invalid obj to cahce";
	}
	var url = urlUtils.normalizeUrl(obj.url);

	updateCache(url || '', obj.pageTitle || '', obj.keywords);
};

function dedup(arr){
	var m = {},
		newArr;

	if(!arr || !arr.length){
		return [];
	}

	newArr = [];

	arr.forEach(function(w){
		if(!m[w]){
			m[w] = { count: 1, word: w };
			newArr.push(m[w]);
		}else{
			m[w].count += 1;
		}
	});

	return newArr.sort((a, b) => b.count > a.count).map(o => o.word);
}

function parseCtx(ctx){
	return dedup(
		ctx.substr(0, Math.min(1000, ctx.length))
			.toLowerCase()
			.replace(REG_LETTER_NUM_COMB, ' $1 ')
			.replace(REG_PUNCTS_EN, ' ')
			.replace(REG_PREP_CN, ' ')
			.replace(REG_PREP_EN, ' ')
			.replace(REG_PUNCTS_CN, ' ')
			.replace(REG_LINE, ' ')
			.replace(REG_SPACE, ' ')
			.split(/ +/)
			.filter(w => Boolean(w) && !REG_PURE_NUM.test(w))
	);
}

function makeSuggestions(url, title, text, note){
	var ctx = [ urlUtils.normalizeUrl(url), title, text, note ].filter(Boolean).join(' '),
		words, rs;

	rs = [];

	words = parseCtx(ctx);

	words.forEach(function(w){
		if(keywordNameMap[w]){
			rs.push(keywordNameMap[w]);
		}
	});

	ctx = words.join('');
	nonEnWords.forEach(function(k){
		if(ctx.indexOf(k.name) >= 0){
			rs.push(k);
		}
	});

	rs = rs.sort((a, b) => {
		if(a.lastUpdateTime == b.lastUpdateTime){
			return b.count - a.count;
		}
		return b.lastUpdateTime - a.lastUpdateTime;
	}).splice(0, 5);


	return rs.map(o => ({ id: o.id, name: o.name }));
}

function updateCache(url, title, keywords){
	var o = keywordNameMap,
		t = new Date().getTime();

	keywords.forEach(k => {
		var obj, name;

		if(!k.id || !k.name || !k.count){
			return;
		}

		name = k.name.toLowerCase();

		obj = o[name];

		if(!obj){
			o[name] = { count: k.count, id: k.id, name: k.name, lastUpdateTime: t };
			keywordIdMap[k.id] = o[name];

			if(REG_NON_EN.test(name)){
				nonEnWords.push(o[name]);
			}
		}else{
			obj.count += k.count;
			obj.lastUpdateTime = t;
		}
	});

	if(!inited){
		initCache();
	}

	return true;
}

function initCache(pageNo, remainCount){
	//分页获取初始关键词列表
	var pn = pageNo || 1,
		rc = remainCount === 0? 0: (remainCount || INIT_FETCH_COUNT);

	if(!rc){
		return;
	}

	if(inited && pn === 1){
		return;
	}

	keywordStore.search({}, {
		pagination: { pageNo: pn, pageSize: Math.min(MAX_PAGE_SIZE, rc) },
		project: { keyword: true }
	}).then(function(rs){
		if(rs.result){
			inited = inited || true;
			console.log("successfully fetch page: ", pn);
			updateCache(null, null, (rs.result || []).map(o => ({ id: o.pk, name: o.object.keyword, count: 1 })));
			if(rs.result.length >= MAX_PAGE_SIZE){
				return initCache(pn + 1, rc - rs.result.length);
			}
		}else{
			console.warn('init keyword cache failed');
		}
	}).catch(function(e){
		console.warn('init keyword cache failed: ', e);
	});
};

initCache();
