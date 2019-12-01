const Rx = require('rxjs');
const Immutable = require('immutable');

const timeUtils = require('./utils/time-utils');

const DEFAULT_WHITELIST = require('./data/default-whitelist');
const DEFAULT_BLACKLIST = require('./data/default-blacklist');

const PROP_SETTINGS = 'docgagasettings';

const SETTING = {};
const SETTING_DESC = {};
const SETTING_DEP = {};
const SETTING_MUTEX = {};
const SETTING_FORMATTER = {};

SETTING.DOCGAGA_VERSION = 'docgaga.version';
SETTING.LAST_UPDATE_TIME = 'settings.last_update_time';
SETTING.USE_LOCAL = 'settings.use_local';
SETTING.AUTO_SYNC = 'settings.auto_sync';
SETTING.REFRESH_ON_OPEN = 'refresh_on_open';
SETTING.AUTO_OPEN_NOTE_LIST = 'auto_open_note_list';
SETTING.AUTO_SEARCH_NOTE = 'auto_search_note';
SETTING.AUTO_OPEN_WHEN_NOTE_FOUND = 'auto_open_when_note_found';
SETTING.EXPAND_SEARCH_SCOPE_TO = 'expand_search_scope_to';
SETTING.ENABLE_WHITELIST = 'enable_whitelist';
SETTING.ENABLE_BLACKLIST = 'enable_blacklist';
SETTING.WHITELIST = 'whitelist';
SETTING.WHITELIST_EXCEPTIONS = 'whitelist_exceptions';
SETTING.BLACKLIST = 'blacklist';
SETTING.BLACKLIST_EXCEPTIONS = 'blacklist_exceptions';

SETTING_DESC[SETTING.DOCGAGA_VERSION] = "汤圆笔记浏览器插件版本";
SETTING_DESC[SETTING.LAST_UPDATE_TIME] = "最近一次更新配置的时间";
SETTING_DESC[SETTING.USE_LOCAL] = "选择使用本地配置还是在线的配置。本地配置只在当前这台机器的这个客户端(浏览器)使用;在线配置可以在任意机器的客户端中使用";
SETTING_DESC[SETTING.AUTO_SYNC] = "开启该选项将自动同步本地和在线配置。注意：该选项只在使用在线配置时有效";
SETTING_DESC[SETTING.REFRESH_ON_OPEN] = "开启该选项将在笔记列表展开时自动加载或检查笔记更新";
SETTING_DESC[SETTING.AUTO_SEARCH_NOTE] = "在页面加载时自动加载当前页面记过的笔记";
SETTING_DESC[SETTING.AUTO_OPEN_NOTE_LIST] = "开启该选项将在页面打开时自动获取您在该页面做过的笔记";
SETTING_DESC[SETTING.AUTO_OPEN_WHEN_NOTE_FOUND] = "开启该选项将在发现当前页面有记过笔记时自动展开笔记列表;该选项只在开启\"打开页面时自动查找当前页面记过的笔记\"时有效";
SETTING_DESC[SETTING.EXPAND_SEARCH_SCOPE_TO] = "选择在第一次(自动/手动)加载笔记时是否自动扩大到指定的搜索范围再进行搜索";
SETTING_DESC[SETTING.ENABLE_BLACKLIST] = "开启黑名单之后，访问黑名单中网页时将不在该页面上启动汤圆笔记，您还可以添加一些特殊情况，让黑名单中的网站的某些页面可以启动汤圆笔记";
SETTING_DESC[SETTING.BLACKLIST] = "黑名单";
SETTING_DESC[SETTING.BLACKLIST_EXCEPTIONS] = "黑名单例外情况";
SETTING_DESC[SETTING.ENABLE_WHITELIST] = "开启白名单之后，只有白名单上的页面上才会启动汤圆笔记，您还可以添加一些特殊情况，让白名单中的网站的某些页面不启动汤圆笔记";
SETTING_DESC[SETTING.WHITELIST] = "白名单";
SETTING_DESC[SETTING.WHITELIST_EXCEPTIONS] = "白名单例外情况";

SETTING_DEP[SETTING.AUTO_SYNC] = { setting: SETTING.USE_LOCAL, value: (v) => !v };
SETTING_DEP[SETTING.AUTO_OPEN_WHEN_NOTE_FOUND] = { setting: SETTING.AUTO_SEARCH_NOTE, value: (v) => Boolean(v) };

SETTING_MUTEX[SETTING.ENABLE_WHITELIST] = { 
    settings: [
        { setting: SETTING.ENABLE_BLACKLIST, value: (v) => Boolean(v), alt: false },
        { setting: SETTING.ENABLE_WHITELIST, value: (v) => Boolean(v), alt: false }
    ], 
    required: false
};
SETTING_MUTEX[SETTING.ENABLE_BLACKLIST] = SETTING_MUTEX[SETTING.ENABLE_WHITELIST];

SETTING_FORMATTER[SETTING.LAST_UPDATE_TIME] = (v) => {
    var t;
    if(v){
        t = new Date();
        t.setTime(v);
        return timeUtils.dateTime(t, '-', true)+"("+timeUtils.since(t)+")";
    }else{
        return '默认配置';
    }
};

const DEFAULT_SETTINGS = (function(){
    var m = {};

    m[SETTING.DOCGAGA_VERSION] = 'v1.0.0';
    m[SETTING.LAST_UPDATE_TIME] = 0;
    m[SETTING.USE_LOCAL] = true;
    m[SETTING.AUTO_SYNC] = true;
    m[SETTING.AUTO_OPEN_NOTE_LIST] = false;
    m[SETTING.REFRESH_ON_OPEN] = true;
    m[SETTING.AUTO_SEARCH_NOTE] = true;
    m[SETTING.AUTO_OPEN_WHEN_NOTE_FOUND] = true;
    m[SETTING.EXPAND_SEARCH_SCOPE_TO] = 'all';
    m[SETTING.ENABLE_WHITELIST] = false;
    m[SETTING.ENABLE_BLACKLIST] = true;
    m[SETTING.WHITELIST] = DEFAULT_WHITELIST;
    m[SETTING.WHITELIST_EXCEPTIONS] = [];
    m[SETTING.BLACKLIST] = DEFAULT_BLACKLIST;
    m[SETTING.BLACKLIST_EXCEPTIONS] = [];

    return Immutable.fromJS(m);
}());

module.exports = getSettings;

var cr, singleton;

/**
 * @param {ChromeUtils} [chrome] - only for test
 * @return {DocGagaSettings} 
 */
function getSettings(chrome){
    cr = cr? cr: (chrome? chrome: require('./utils/chrome'));
    if(!singleton){
        singleton = new DocGagaSettings();
    }
    return singleton;
}

getSettings.DocGagaSettings = DocGagaSettings;

DocGagaSettings.SETTING = SETTING;
DocGagaSettings.SETTING_DESC = SETTING_DESC;
DocGagaSettings.SETTING_DEP = SETTING_DEP;
DocGagaSettings.SETTING_MUTEX = SETTING_MUTEX;
DocGagaSettings.SETTING_FORMATTER = SETTING_FORMATTER;
DocGagaSettings.DEFAULT_SETTINGS = DEFAULT_SETTINGS;

function DocGagaSettings(){
    this.localSettings = null;
}

DocGagaSettings.prototype.getSettings = function(){
    if(!this.localSettings){
        this.localSettings = readLocalSettings();
    }
    return this.localSettings;
};

/**
 * @param {Array<Object>} items
 * @return {Boolean}
 */
DocGagaSettings.prototype.requireSettings = function(items){
    var self = this,
        rules = {};
    
    items.forEach(i => rules[i.name] = i.value);

    return self.getSettings().then(function(settings){
        var list = Immutable.fromJS(items.map(i => ({ name: i.name, value: settings.get(i.name) }))),
            map = Immutable.Map(list.map(i => [ i.get('name'), i.get('value') ])),
            sat = list.filter(i => {
                var name = i.get('name'),
                    value = i.get('value'),
                    rule = rules[name];
                
                if(rule === undefined || rule === null){
                    console.warn('rule not defined for setting: ', name);
                    return false;
                }
                    
                if(typeof rule == 'function'){
                    return rule.call(null, value, name, map);
                }else if(rule instanceof RegExp && typeof value == 'string'){
                    return rule.test(value);
                }else if(!(rule instanceof RegExp)){
                    return value == rule;
                }else{
                    return false;
                }
            }),
            unsat = () => list.filter(i => !sat.some(s => s.get('name') == i.get('name')));

        if(sat.size === list.size){
            return {
                'success': true,
                'result': Immutable.Map(sat.map(i => [ i.get('name'), i.get('value') ]))
            };
        }else{
            return {
                'error': 'settings_unsatisfied',
                'result': Immutable.Map(unsat().map(i => [ i.get('name'), i.get('value') ]))
            };
        }
    });
};

DocGagaSettings.prototype.saveSettings = function(s, opts){
    opts = opts || {};
    var syncUp = !s.get(SETTING.USE_LOCAL) && s.get(SETTING.AUTO_SYNC),
        js = {},
        ret, user;
    
    s = s.set(SETTING.LAST_UPDATE_TIME, new Date().getTime());

    js[PROP_SETTINGS] = s.toJS();

    console.log();

    ret = cr.setProperties(js);

    if(syncUp){
        ret = ret.then(function(){
            //TODO sync up to online settings
            return true;
        });
    }

    return ret;
};

DocGagaSettings.prototype.restoreToDefault = function(){
    return this.saveSettings(DEFAULT_SETTINGS);
};

function readLocalSettings(){
    return cr.getProperties([ PROP_SETTINGS ]).then(function(props){
        var st = props && props[PROP_SETTINGS];
        if(st){
            return Immutable.fromJS(st);
        }else{
            return DEFAULT_SETTINGS;
        }
    });
}
