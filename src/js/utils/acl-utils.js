const Immutable = require('immutable');

const urlUtils = require('./url-utils');

const Settings = require('../settings'),
	SETTING = Settings.DocGagaSettings.SETTING,
	settings = Settings();

module.exports.checkShouldLaunch = checkShouldLaunch;

function checkShouldLaunch(){
    	
    var conds = [];

    conds.push(settings.requireSettings([ 
        { name: SETTING.ENABLE_WHITELIST, value: false },
        { name: SETTING.ENABLE_BLACKLIST, value: false }
    ]));

    conds.push(settings.requireSettings([
        { name: SETTING.ENABLE_WHITELIST, value: true },
        { name: SETTING.ENABLE_BLACKLIST, value: false },
        { name: SETTING.WHITELIST_EXCEPTIONS, value: () => true },
        { name: SETTING.WHITELIST, value: (list, key, map) => {
            var enabled = map.get(SETTING.ENABLE_WHITELIST),
                ex = map.get(SETTING.WHITELIST_EXCEPTIONS);
            return enabled && (
                list.some(i => matchListItem(i)) &&
                !ex.some(i => matchListItem(i))
            );
        }}
    ]));

    conds.push(settings.requireSettings([
        { name: SETTING.ENABLE_WHITELIST, value: false },
        { name: SETTING.ENABLE_BLACKLIST, value: true },
        { name: SETTING.BLACKLIST_EXCEPTIONS, value: () => true },
        { name: SETTING.BLACKLIST, value: (list, key, map) => {
            var enabled = map.get(SETTING.ENABLE_BLACKLIST),
                ex = map.get(SETTING.BLACKLIST_EXCEPTIONS);
            return enabled && (
                    !list.some(i => matchListItem(i)) ||
                    ex.some(i => matchListItem(i))
            );
        }}
    ]));

    return Promise.all(conds).then(function(rss){
        return rss.some(i => i.success);
    });
}

module.exports.matchListItem = matchListItem;

function matchListItem(item, url){
    var loc = url || new String(window.location.href);
	try{
		if(item.get('disabled')){
			return false;
		}
		var p = item.get('url'),
			c = urlUtils.parseUrl(loc),
			type = item.get('type');

		if(type != 'regex'){
			p = urlUtils.parseUrl(p);
		}

		switch(type){
			case 'page': 
				if(normHost(p.host) == normHost(c.host)){
					if(p.port == c.port && normPath(p.path) == normPath(c.path)){
						return true;
					}
				}
				break; 
			case 'site':
				if(matchHost(normHost(p.host), normHost(c.host))){
					if(p.port == c.port){
						return true;
					}
				}
				break;
			case 'prefix':
				if(normHost(p.host) == normHost(c.host) &&
					p.port == c.port &&
					normPath(c.path).indexOf(normPath(p.path)) === 0){
					return true;
				}
				break;
			case 'regex':
				return RegExp(p).test(loc);
			default: break;
		}
	}catch(e){
		console.error(e);
	}

	return false;
}

module.exports.addWhitelistItem = addWhitelistItem;

function addWhitelistItem(item){
	Promise.resolve().then(function(){
		if(!item || !item.url || !(item.type == 'site' || item.type == 'page')){
			return false;
		}
		try{
			var originUrl = item.url,
				url = urlUtils.parseUrl(originUrl),
				i, name, value;

			if(item.type == 'site'){
				url = url.origin;
				name = url;
			}else{//page
				url = (url.origin || '') + (url.path || '');
				name = item.name;
			}

			if(!url){
				throw "invalid url";
			}

			i = Immutable.fromJS({ name: name, type: item.type, url: url });

			if(item.disabled){
				i = i.set('disabled', true);
			}
			
			return Promise.all([settings.getSettings(), i, originUrl]);
		}catch(e){
			console.error(e);
			return false;
		}
	}).then(function(o){
		if(!o){
			return false;
		}

		o = { settings: o[0], item: o[1], url: o[2] };

		var s = o.settings,
			changed = false,
			wl, blEx;

		wl = o.settings.get(SETTING.WHITELIST);
		blEx = o.settings.get(SETTING.BLACKLIST_EXCEPTIONS);

		if(!wl.some(i => matchListItem(i, o.url))){
			wl = wl.unshift(o.item);
			changed = true;
		}

		if(!blEx.some(i => matchListItem(i, o.url))){
			blEx = blEx.unshift(o.item);
			changed = true;
		}

		if(changed){
			s = s.set(SETTING.WHITELIST, wl).set(SETTING.BLACKLIST_EXCEPTIONS, blEx);
			return settings.saveSettings(s);
		}

		return true;
	});
}

module.exports.addBlacklistItem = addBlacklistItem;

function addBlacklistItem(item){
	Promise.resolve().then(function(){
		if(!item || !item.url || !(item.type == 'site' || item.type == 'page')){
			return false;
		}
		try{
			var originUrl = item.url,
				url = urlUtils.parseUrl(originUrl),
				value, name, i;

			if(item.type == 'site'){
				url = url.origin;
				name = url;
			}else{//page
				url = (url.origin || '') + (url.path || '');
				name = item.name;
			}

			if(!url){
				throw "invalid url";
			}

			i = Immutable.fromJS({ name: name, type: item.type, url: url });

			if(item.disabled){
				i = i.set('disabled', true);
			}
			
		}catch(e){
			console.error(e);
			return false;
		}

		return Promise.all([settings.getSettings(), i, originUrl]);
	}).then(function(o){
		if(!o){
			return false;
		}

		o = { settings: o[0], item: o[1], url: o[2] };

		var s = o.settings,
			changed = false,
			bl, wlEx;

		bl = o.settings.get(SETTING.BLACKLIST);
		wlEx = o.settings.get(SETTING.WHITELIST_EXCEPTIONS);

		if(!bl.some(i => matchListItem(i, o.url))){
			bl = bl.unshift(o.item);
			changed = true;
		}

		if(!wlEx.some(i => matchListItem(i, o.url))){
			wlEx = wlEx.unshift(o.item);
			changed = true;
		}

		if(changed){
			s = s.set(SETTING.BLACKLIST, bl).set(SETTING.WHITELIST_EXCEPTIONS, wlEx);
			return settings.saveSettings(s);
		}

		return true;
	});
}

function matchHost(pattern, host){
	var i;

	if(pattern == host){
		return true;
	}else{//sub domain
		i = host.indexOf(pattern);
		if(i === (host.length - pattern.length) && 
			host[i-1] == '.'){
			return true;
		}
	}

	return false;
}

function normPath(path){
	return (path || '').replace(/\/+/g, '/').replace(/\/$|^\/| +/g, '');
}

function normHost(host){
	return (host || '').replace(/^www\.| +/i, '');
}
