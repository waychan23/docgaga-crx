const $ = require('jquery'),
    Rx = require('rxjs'),
    Immutable = require('immutable'),
    diff = require('immutablediff');

const matchListItem = require('./utils/acl-utils').matchListItem;
const Settings = require('./settings'),
    SETTING =  Settings.DocGagaSettings.SETTING,
    SETTING_DESC = Settings.DocGagaSettings.SETTING_DESC,
    SETTING_DEP = Settings.DocGagaSettings.SETTING_DEP,
    SETTING_MUTEX = Settings.DocGagaSettings.SETTING_MUTEX,
    SETTING_FORMATTER = Settings.DocGagaSettings.SETTING_FORMATTER,
    settings = Settings();

const ACL_ITEM_TYPE = {
    'site': { name: '网站' },
    'page': { name: '网页' },
    'prefix': { name: '前缀' },
    'regex': { name: '正则' }
};

var domMap = {};
var state = Immutable.fromJS({
    'listSearchStr': '',
    'renderTimes': -1
});
var unloadFor;

var settingsChanged = new Rx.BehaviorSubject(Immutable.Map())
                            .distinctUntilChanged((a, b) => diff(a, b).length)
                            .do(sets => state = state.set('settings', sets).set('renderTimes', state.get('renderTimes') + 1));

function valOrExpr(v, e){
    if(typeof e == 'function'){
        return e.call(null, v);
    }
    return v == e;
}

function renderSettings(sets){
    sets.forEach(function(v, k){
        var l = domMap.settings[k],
            p = SETTING_DEP[k], t;
        
        if(!l || (!(l instanceof ACL) && !l.length)){
            return;
        }

        t = $(l)[0].nodeName;

        if(!Immutable.List.isList(v)){
            if(/^(input)$/i.test(t)){
                if(l.attr('type') == 'checkbox'){
                    l.prop('checked', Boolean(v));
                }else{
                    l.val(v);
                }
            }else if(/^(select)$/i.test(t)){
                l.val(String(v));
            }else if(/^(span|div|th|td|label|li)$/i.test(t)){
                l.text(SETTING_FORMATTER[k]? SETTING_FORMATTER[k](v): String(v));
            }
        }else{
            l.setItems(v);
        }

        if(p && !valOrExpr(sets.get(p.setting), p.value)){
            (l.getDom?l.getDom():l).closest('.item-block').hide();
        }else{
            (l.getDom?l.getDom():l).closest('.item-block').show();
        }
    });

    domMap.settings['whitelist'].getDom().closest('div[data-role=list-wrapper]').attr('data-selected', String(sets.get('enable_whitelist')));
    domMap.settings['blacklist'].getDom().closest('div[data-role=list-wrapper]').attr('data-selected', String(sets.get('enable_blacklist')));

}

function loadSettings(){
    //Rx.Observable.fromPromise(settings.getSettings()).do((sets) => state.sets = sets).subscribe(renderSettings);
    Rx.Observable.fromPromise(settings.getSettings()).subscribe(settingsChanged.next.bind(settingsChanged));
}

function initDom(){
    var sts = domMap.settings = {},
        qs = domMap.settingDescs = {};

    $(".setting-value").each(function(index, i){
        var setting = $(i).data("setting");
        if(setting){
            sts[setting] = $(i);
        }
    });

    $(".question").each(function(index, i){
        var setting = $(i).data('setting');
        if(setting){
            qs[setting] = $(i);
            $(i).prop('title', SETTING_DESC[setting] || '');
        }
    });

    sts[SETTING.WHITELIST_EXCEPTIONS] = ACL($("*[data-acl=whitelist-exception]"), SETTING.WHITELIST_EXCEPTIONS);
    sts[SETTING.WHITELIST] = ACL($("*[data-acl=whitelist]"), SETTING.WHITELIST);
    sts[SETTING.BLACKLIST_EXCEPTIONS] = ACL($("*[data-acl=blacklist-exception]"), SETTING.BLACKLIST_EXCEPTIONS);
    sts[SETTING.BLACKLIST] = ACL($("*[data-acl=blacklist]"), SETTING.BLACKLIST);

    domMap.listSearchInput = $("#list-search-input");

    domMap.saveBtn = $("#control-btn-group").find('*[data-role=save-btn]');
    domMap.cancelBtn = $("#control-btn-group").find('*[data-role=cancel-btn]');
    domMap.restoreBtn = $("#control-btn-group").find('*[data-role=restore-btn]');
}

function initEvents(){

    settingsChanged.subscribe(renderSettings);

    [ SETTING.WHITELIST, SETTING.WHITELIST_EXCEPTIONS, SETTING.BLACKLIST, SETTING.BLACKLIST_EXCEPTIONS ].forEach(
        (listName) => domMap.settings[listName].itemsChanged.subscribe(items => {
            settingsChanged.next(state.get('settings').set(listName, items))
        })
    );
    
    Rx.Observable.fromEvent($('input[type=checkbox].setting-value, select.setting-value'), 'change')
        .map(evt => ({ setting: $(evt.target).data('setting'), value: /select/i.test($(evt.target)[0].nodeName)?$(evt.target).val():$(evt.target).prop('checked') }))
        .map((o) => {
            //deal with mutable exclusive
            var mutex = SETTING_MUTEX[o.setting],
                which, whichNot, beTrue, v, n, patch;
            
            if(o.value == 'true' || o.value == 'false'){
                o.value = o.value == 'true';
            }

            n = state.get('settings').set(o.setting, o.value);

            if(mutex){
                which = mutex.settings.filter(s => s.setting == o.setting)[0];
                whichNot = mutex.settings.filter(s => s.setting != o.setting);
                beTrue = mutex.settings.filter(s => valOrExpr(n.get(s.setting), s.value));
                v = valOrExpr(n.get(o.setting), which.value);

                if(mutex.required && !beTrue.length){
                    n = state.get('settings');
                }else if(beTrue.length > 1 && v){
                    patch = {};
                    whichNot.forEach(s => patch[s.setting] = s.alt);
                    n = n.merge(Immutable.Map(patch));
                }
            }

            return n;
        }).subscribe(settingsChanged.next.bind(settingsChanged));

    Rx.Observable.fromEvent(domMap.listSearchInput, 'input change compositionend')
                .map(evt => $(evt.target).val().trim())
                .distinctUntilChanged()
                .debounceTime(300)
                .subscribe((str) => {
                    [ SETTING.WHITELIST, SETTING.WHITELIST_EXCEPTIONS, SETTING.BLACKLIST, SETTING.BLACKLIST_EXCEPTIONS ]
                        .map(setting => domMap.settings[setting])
                        .forEach(acl => acl.filter((i) => {
                            if(!str){
                                return true;
                            }

                            var url = String(i.get('url')),
                                name = i.get('name'),
                                type = ACL_ITEM_TYPE[i.get('type')].name;

                            str = str.toLowerCase();
                            
                            if(type == str ||
                                url.toLowerCase().indexOf(str) >= 0 ||
                                name.toLowerCase().indexOf(str) >= 0){
                                return true;
                            }

                            return matchListItem(i, str);
                        }))
                });

    Rx.Observable.fromEvent(domMap.saveBtn, 'click').filter(
        () => state.get('renderTimes') > 0? confirm('确定要保存当前修改并立即生效该配置？'): (alert('配置没有修改') && false)
    ).subscribe(() => {
        var s = state.get('settings');

        [ SETTING.WHITELIST, SETTING.BLACKLIST, SETTING.WHITELIST_EXCEPTIONS, SETTING.BLACKLIST_EXCEPTIONS ].forEach(
            (setting) => s = s.set(setting, parseList(s.get(setting)))
        );

        Rx.Observable.fromPromise(settings.saveSettings(s)).subscribe(
            () => {
                alert('配置已更新，已经打开的页面需要刷新才能生效');
                unloadFor = 'refresh';
                window.location.reload();
            }
        );

        function parseList(list){
            return list.map(i => Immutable.Map({ 'type': i.get('type'), 'name': i.get('name'), 'url': i.get('url'), 'disabled': i.get('disabled') }));
        }
    });

    Rx.Observable.fromEvent(domMap.restoreBtn, 'click').filter(
        () => confirm('恢复默认配置会删除您对本地配置的所有修改（不影响已经保存到线上的配置），确定要继续进行？')
    ).subscribe(() => {
        Rx.Observable.fromPromise(settings.restoreToDefault()).subscribe(
            () => {
                alert('已恢复到默认配置');
                unloadFor = 'refresh';
                window.location.reload();
            }
        );
    });

    Rx.Observable.fromEvent(domMap.cancelBtn, 'click').filter(
        () => state.get('renderTimes') > 0? confirm('确定要放弃本次所有的修改？'): (alert('配置没有修改') && false)
    ).subscribe(() => {
        state.set('renderTimes', -1);
        Rx.Observable.fromPromise(settings.getSettings()).do(
            () => {
                alert('修改已撤销');
                unloadFor = 'refresh';
                window.location.reload();
            }
        ).subscribe(renderSettings)
    });

    window.onbeforeunload = function(){
        if(state.get('renderTimes') <= 0 ||
            unloadFor == 'refresh'){
            return;
        }

        return false;
    };
}

function init(){
    initDom();
    initEvents();
    loadSettings();
}

function ACL(dom, name){
    if(!(this instanceof ACL)){
        return new ACL(dom, name);
    }

    var self = this;

    self.state = Immutable.Map({});
    self.config = {
        popupWaitTime: 1500
    };
    
    self.stateUpdateStream = new Rx.BehaviorSubject(Immutable.Map());
    self.itemsChanged = new Rx.BehaviorSubject(Immutable.List());
    
    self.name = name;
    self.domMap = {
        main: dom
    };

    init();

    function init(){
        initDom();
        initEvents();

        self.stateUpdateStream.next(//init state
            Immutable.fromJS({
                searchStr: null,
                searching: false,
                editType: null, //'create'|'update'
                editing: false,
                loading: false,
                showPopup: false,
                popupMsg: '',
                popupHidesAt: 0,
                adding: false,
                addingItem: {
                    'name': '',
                    'type': 'site',
                    'url': ''
                },
                items: []
            })
        );

    }

    function initEvents(){
        var dm = self.domMap;

        Rx.Observable.fromEvent(dm.addBtn, 'click').subscribe(self.add.bind(self));
        Rx.Observable.fromEvent(dm.deleteBtn, 'click').subscribe(self.delete.bind(self));
        Rx.Observable.fromEvent(dm.enableBtn, 'click').subscribe(self.enable.bind(self));

        Rx.Observable.fromEvent(dm.selectAllBtn, 'click')
            .filter(evt => !self.state.get('adding') && !self.state.get('items').some(i => i.get('editingField')))
            .subscribe(self.selectAll.bind(self));

        self.stateUpdateStream.subscribe(self.changed);

        self.stateUpdateStream.map(changes => self.state.merge(changes))
            .distinctUntilChanged((a, b) => diff(a, b).length)
            .do(s => { 
                self.prevState = self.state;
                self.state = s;
            })
            .debounceTime(100)
            .subscribe(self.render.bind(self));

        Rx.Observable.create(
            (observer) => dm.list.on('change', 'li[data-role=item] .list-column[data-field=select] input[type=checkbox]', observer.next.bind(observer))
        ).map(
            (evt) => ({ itemIndex: $(evt.target).closest('li[data-role=item]')[0]._itemIndex, selected: $(evt.target).prop('checked') })
        ).subscribe(
            (o) => self.itemsChanged.next(self.state.get('items').set(o.itemIndex, self.state.get('items').get(o.itemIndex).set('selected', o.selected)))
        );

        Rx.Observable.create(
            (observer) => dm.list.on('click', 'li[data-role=item] .list-column', observer.next.bind(observer))
        ).filter(
            evt => !self.state.get('adding') && !self.state.get('items').some(i => i.get('editingField'))
        ).map(
            evt => {
                evt.stopPropagation();
                return { 
                    'field': $(evt.target).data('field'), 
                    'itemIndex': $(evt.target).closest('li[data-role=item]')[0]._itemIndex
                };
        }).subscribe(
            o => { 
                var items = self.state.get('items'),
                    item = items.get(o.itemIndex);

                if(!item){
                    return;
                }

                item = items.get(o.itemIndex);
                items = items.set(o.itemIndex, o.field == 'select'? item: item.merge(Immutable.Map({ 'editingField': o.field, 'editingValue': item.get(o.field) })));

                self.itemsChanged.next(items);
            }
        );

        Rx.Observable.create(
            (observer) => dm.main.on('click', '*[data-role=edit-ctrl]', observer.next.bind(observer))
        ).subscribe((evt) => {
            evt.stopPropagation();
        });

        Rx.Observable.create(
            (observer) => dm.list.on('input change compositionend', '*[data-role=edit-ctrl]', observer.next.bind(observer))
        ).map(
            (evt) => ({ itemIndex: $(evt.target).closest('li[data-role=item]')[0]._itemIndex, field: $(evt.target).data('field'), value: $(evt.target).val() })
        ).distinctUntilChanged(
            (a, b) => a.value == b.value && a.field == b.field && a.itemIndex == b.itemIndex
        ).subscribe((o) => {
            var items = self.state.get('items'),
                item = items.get(o.itemIndex);

            if(!item || item.get('editingField') != o.field){
                return;
            }

            self.itemsChanged.next(items.set(o.itemIndex, item.set('editingValue', o.value)));
        });

        Rx.Observable.fromEvent(dm.confirmEditBtn, 'click').filter(
            (evt) => self.state.get('items').some(i => i.get('editingField'))
        ).subscribe(
            () => {
                var cur = self.state.get('items').map((i, index)=> ({ item: i, index: index, editingField: i.get('editingField') })).filter(i => i.editingField).get(0),
                    rs;
                
                if(cur){
                    rs = validateItem(Immutable.fromJS({
                        type: cur.editingField == 'type'? cur.item.get('editingValue'): cur.item.get('type'),
                        name: cur.editingField == 'name'? cur.item.get('editingValue'): cur.item.get('name'),
                        url: cur.editingField == 'url'? cur.item.get('editingValue'): cur.item.get('url'),
                    }));
                }

                if(rs.error){
                    self.promptMsg(rs.error);
                    return;
                }

                self.itemsChanged.next(
                    self.state.get('items').map(
                        (i, index) => i.get('editingField')? i.set(i.get('editingField'), i.get('editingValue')).delete('editingField').delete('editingValue'): i
                    )
                )
            }
        );

        Rx.Observable.fromEvent(dm.cancelEditBtn, 'click').filter(
            evt => 
                self.state.get('items').some(i => 
                    i.get('editingField')
                )
        ).subscribe(
            evt => 
                self.itemsChanged.next(self.state.get('items').map(i => 
                    i.get('editingField')? i.delete('editingField').delete('editingValue'): i)
                )
        );

        Rx.Observable.fromEvent(dm.confirmAddBtn, 'click')
                        .filter(evt => self.state.get('adding'))
                        .map(evt => validateItem(self.state.get('addingItem')))
                        .do(rs => {
                            if(rs.error){
                                self.promptMsg(rs.error);
                            }
                        })
                        .filter(rs => !rs.error)
                        .subscribe(rs => {
                            var items = self.state.get('items').unshift(self.state.get('addingItem'));
                            self.setState({ adding: false, addingItem: null });
                            self.itemsChanged.next(items);
                        });

        Rx.Observable.fromEvent(dm.cancelAddBtn, 'click')
                        .filter(evt => self.state.get('adding'))
                        .subscribe(evt => {
                            self.setState({ adding: false, addingItem: null });
                        });

        Rx.Observable.create(
            (observer) => dm.newLine.on('change input compositionend', 'input[data-role=add-ctrl],select[data-role=add-ctrl]', observer.next.bind(observer))
        )
        .map(evt => {
           return ({ field: $(evt.target).data('field'), value: $(evt.target).val().trim() })
        })
        .map(o => self.state.get('addingItem').set(o.field, o.value))
        .distinctUntilChanged((a, b) => diff(a, b).length)
        .subscribe(addingItem => self.setState({ addingItem: addingItem }));

        function validateItem(item){
            var type = item.get('type'),
                name = item.get('name'),
                url = item.get('url').trim();

            if(!url){
                return { error: '必须填写网址' };
            }

            if(type == 'regex'){
                try{
                    url = RegExp(url);
                    if(!url){
                        throw "not a valid regular expression";
                    }
                }catch(e){
                    return { error: '正则表达式有语法错误' };
                }
            }

            return { error: null };
        }
    }

    function initDom(){
        var dm = self.domMap;

        dm.main.css('position', 'relative');
        dm.generalBtnGroup = dm.main.find('.list-op-btn-group[data-role=general]').show();
        dm.addBtn = dm.generalBtnGroup.find('*[data-role=add-btn]');
        dm.deleteBtn = dm.generalBtnGroup.find('*[data-role=delete-btn]');
        dm.enableBtn = dm.generalBtnGroup.find('*[data-role=enable-btn]');
        dm.addBtnGroup = dm.main.find('.list-op-btn-group[data-role=add]').hide();
        dm.confirmAddBtn = dm.addBtnGroup.find('*[data-role=confirm-add-btn]');
        dm.cancelAddBtn = dm.addBtnGroup.find('*[data-role=cancel-add-btn]');
        dm.selectAllBtn = dm.main.find('*[data-role=select-all-btn]');
        dm.editBtnGroup = dm.main.find('.list-op-btn-group[data-role=edit]').hide();
        dm.confirmEditBtn = dm.editBtnGroup.find('*[data-role=confirm-edit-btn]');
        dm.cancelEditBtn = dm.editBtnGroup.find('*[data-role=cancel-edit-btn]');
        dm.list = dm.main.find('ul');
        dm.info = dm.main.find('li[data-role=info]').hide();
        dm.itemCount = dm.main.find('.item-count');
        dm.popup = $("<div class=\"msg-popup\"></div>").hide().appendTo(dm.main);
        dm.ed = {
            'name': $('<input data-field="name" data-role="edit-ctrl"/>'),
            'url': $('<input data-field="url" data-role="edit-ctrl"/>'),
            'type': $('<select data-field="type" data-role="edit-ctrl"> \
                         <option value="site">网站</option> \
                         <option value="page">网页</option> \
                         <option value="prefix">前缀</option> \
                         <option value="regex">正则</option> \
                       </select>')
        };
        dm.newLine = $('<li data-role="new-line"> \
                          <span class="list-column" data-field="select"></span> \
                          <span class="list-column" data-field="name"> \
                            <input data-field="name" data-role="add-ctrl"/>\
                          </span> \
                          <span class="list-column" data-field="type"> \
                            <select data-field="type" data-role="add-ctrl"> \
                              <option value="site">网站</option> \
                              <option value="page">网页</option> \
                              <option value="prefix">前缀</option> \
                              <option value="regex">正则</option> \
                            </select> \
                          </span> \
                          <span class="list-column" data-field="url"> \
                            <input data-field="url" data-role="add-ctrl"/> \
                          </span> \
                        </li>').hide().insertBefore(dm.list.find('li').eq(0));
    }
}

ACL.prototype.setState = function(changes, opts){
    opts = opts || {};

    var self = this;

    self.stateUpdateStream.next(Immutable.fromJS(changes));
    if(opts.popupMsg){
        self.promptMsg(opts.popupMsg);
    }
};

ACL.prototype.promptMsg = function(msg){
    var self = this;

    if(!msg){
        return;
    }

    self.setState({ showPopup: true, popupMsg: msg || '', popupHidesAt: new Date().getTime() + self.config.popupWaitTime });
    Rx.Scheduler.async.schedule(() => { if(new Date().getTime() >= self.state.get('popupHidesAt')) self.setState({ showPopup: false, popupMsg: '' }) }, self.config.popupWaitTime + 50);
};

ACL.prototype.filter = function(filter){
    var self = this;
    if(typeof filter == 'function'){
        self.itemsChanged.next(self.state.get('items').map(i => !filter(i)? i.set('filtered', true): i.delete('filtered')));
    }
};

ACL.prototype.setItems = function(items){
    var self = this;

    items = items || [];

    self.setState({ 'items': items });
};

ACL.prototype.render = function(){
    var self = this,
        dm = self.domMap,
        items = this.state.get('items') || Immutable.List(),
        t = new Date().getTime(),
        editing = items.some(i => i.get('editingField')),
        itemDoms = dm.list.find('li[data-role=item]'),
        count, item, isNew;

    if(self.state.get('showPopup')){
        dm.popup.text(self.state.get('popupMsg')).show();
    }else{
        dm.popup.text(self.state.get('popupMsg')).fadeOut();
    }
    
//    dm.list.find('li[data-role=item]').remove();

    count = items.count(i => !i.get('filtered'));

    if(!items.size || !count){
        dm.list.find('li[data-role=info]').each((index, i) => $(i).data('info') != (items.size?'no-match':'empty-list')? $(i).hide(): $(i).show())
    }else{
        dm.list.find('li[data-role=info]').hide();
    }

    dm.itemCount.text(count+'/'+items.size);

    items.forEach(function(item, index){
        var dom = (index < itemDoms.length)?itemDoms.eq(index): null;
        if(dom){
            createItemDom(item, index, dom);
        }else{
            createItemDom(item, index).appendTo(dm.list);
        }
    });

    if(itemDoms.length > items.size){
        itemDoms.each((index, itemDom) => index >= items.size? itemDom.remove(): null);
    }
    
    dm.list.find('*[data-role=edit-ctrl]').focus();

    if(self.state.get('adding')){
        item = self.state.get('addingItem');
        if(dm.newLine.css('display') == 'none'){
            dm.newLine.show();
            dm.newLine.find('input[data-field=name]').focus();
            dm.list.scrollTop(0);
        }
        dm.main.find('.list-op-btn-group').hide();
        dm.addBtnGroup.show();
        dm.newLine.find('input[data-field=name]').val(item.get('name'));
        dm.newLine.find('select[data-field=type]').val(item.get('type'));
        dm.newLine.find('input[data-field=url]').val(item.get('url'));
    }else if(editing){
        dm.main.find('.list-op-btn-group').hide();
        dm.editBtnGroup.show();
    }else{
        dm.newLine.hide();
        dm.main.find('.list-op-btn-group').hide();
        dm.generalBtnGroup.show();
    }

    function createItemDom(item, index, d){
        d = d || $(
            '<li data-role="item" title="点击修改"> \
               <span class="list-column" data-field="select"> \
                <input type="checkbox"/> \
               </span> \
               <span class="list-column" data-field="name"></span> \
               <span class="list-column" data-field="type"></span> \
               <span class="list-column" data-field="url"></span> \
            </li>'
        );
        return poputeItemDom(d, item, index);
    }

    function poputeItemDom(dom, item, index){
        var type = item.get('type'),
            name = item.get('name') || '-',
            url = item.get('url') || '-';

        if(!type){
            type = '-';
        }else{
            type = ACL_ITEM_TYPE[type]? ACL_ITEM_TYPE[type].name: '-';
        }

        dom.find('.list-column[data-field=select] input[type=checkbox]')
            .filter((index, l) => $(l).prop('checked') != Boolean(item.get('selected')))
            .prop('checked', Boolean(item.get('selected')));
        dom.find('.list-column[data-field=name]')
            .filter((index, l) => $(l).prop('title') != name)
            .text(name)
            .prop('title', name);
        dom.find('.list-column[data-field=type]')
            .filter((index, l) => $(l).text() != type)
            .text(type);
        dom.find('.list-column[data-field=url]')
            .filter((index, l) => $(l).text() != url)
            .text(url)
            .prop('title', url);
        if(item.get('disabled')){
            dom.filter((index, l) => !$(l).hasClass('list-item-disabled')).addClass('list-item-disabled');
        }else{
            dom.filter((index, l) => $(l).hasClass('list-item-disabled')).removeClass('list-item-disabled');
        }

        if(dom[0]._itemIndex != index){
            dom[0]._itemIndex = index;
        }

        return checkEditing(dom, item, index);
    }

    function checkEditing(dom, item, index){
        var edField = item.get('editingField') || '';

        if(edField){
            dm.ed[edField].val(item.get('editingValue')).appendTo(dom.find('.list-column[data-field='+edField+']').empty());
        }else{
            dom.find('*[data-role=edit-ctrl]').each((index, domItem) => {
                domItem = $(domItem);

                var field = domItem.data('field'),
                    column = domItem.parent();
                domItem.remove();
                column.text(item.get(field));
            });
        }

        return checkVisibility(dom, item, index);
    }

    function checkVisibility(dom, item, index){
        if(item.get('filtered')){
            dom.hide();
        }else{
            dom.show();
        }
        return dom;
    }
};

ACL.prototype.getDom = function(){
    return this.domMap.main;
};

ACL.prototype.selectAll = function(){
    var self = this,
        items = self.state.get('items'),
        hasSelected = items.some(i => i.get('selected')),
        hasUnselected = items.some(i => !i.get('selected'));

    if(hasSelected && hasUnselected || !hasSelected){
        self.itemsChanged.next(items.map(i => i.set('selected', true)));
    }else{
        self.itemsChanged.next(items.map(i => i.set('selected', false)));
    }
};

ACL.prototype.delete = function(){
    var self = this,
        items = self.state.get('items'),
        notToDel = items.filter(i => !i.get('selected'));

    if(notToDel.size == items.size){
        self.promptMsg('请先勾选要删除的项');
        return;
    }

    if(!confirm('确定要删除选中的项?')){
        return;
    }

    self.itemsChanged.next(notToDel);
};

ACL.prototype.add = function(){
    var self = this;

    if(!self.state.get('adding')){
        self.setState(Immutable.fromJS({
            adding: true,
            addingItem: {
                name: '',
                type: 'site',
                url: ''
            },
        }));
    }
};

ACL.prototype.toggleSearch = function(){

};

ACL.prototype.enable = function(){
    var self = this,
        items = self.state.get('items').filter(i => i.get('selected')),
        unselected = self.state.get('items').filter(i => !i.get('selected')),
        disabled, enabled;

    if(!items.size){
        self.promptMsg('请先勾选要操作的项');
        return;
    }

    disabled = items.some(i => i.get('disabled')),
    enabled = items.some(i => !i.get('disabled'));

    if(disabled && enabled || !disabled){
        self.itemsChanged.next(unselected.concat(items.map(i => i.set('disabled', true))));
        self.promptMsg('所选择的项已被停用，并移至列表底部');
    }else{
        self.itemsChanged.next(unselected.concat(items.map(i => i.set('disabled', false))));
        self.promptMsg('所选择的项已被启用');
    }
};

init();