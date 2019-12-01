"use strict";

var $ = require('jquery'),
    SimpleEventEmitter = require('../base/simple-event-emitter'),
    domPos = require('../utils/dom-position'),
    asap = require('../utils/asap');

module.exports = function (options) {
    options = options || {};

    var exports,
        templates = {
            'main': "<div class=\"docgaga-op-menu\"></div>"
        },
        stateMap = {},
        eventEmitter = new SimpleEventEmitter(),
        queryMap;

    function init() {
        initDom();
    };

    function destroy() {
        eventEmitter.clearHandlers();

        queryMap.main.remove();

        queryMap = null;
    }

    function initDom() {
        queryMap = {};

        queryMap.parent = $(document.body);

        queryMap.main = $(templates.main);
        queryMap
            .main
            .appendTo(queryMap.parent);

        initButtons();

        function initButtons() {
            var btns = options.btns || [];
            btns.forEach(function (btn) {
                addButton(btn);
            });
        }

        function addButton(btnObj) {
            if (!btnObj) {
                return;
            }

            queryMap[btnObj.btnId] = $("<a class=\"docgaga-op-btn " + btnObj.btnId + "\">" + btnObj.name + "</a>");

            queryMap[btnObj.btnId].appendTo(queryMap.main);

            queryMap[btnObj.btnId].on('mousedown mouseup', function (event) {
                event.preventDefault();
                event.stopPropagation();
            });

            queryMap[btnObj.btnId].on('click', function (event) {
                btnObj
                    .handler
                    .apply(this, [event, stateMap.selection]);
                btnObj.hideAfter && hide();
            });
        }
    };

    function reposition(selection, callback) {
        asap(function () {
            var pos = domPos.avoidOutOfClient(queryMap.main, {
                'pageX': selection.position.pageX,
                'pageY': selection.position.pageY,
                'clientX': selection.position.clientX,
                'clientY': selection.position.clientY
            }, {
                'offsetX': 15,
                'offsetY': 20
            });

            queryMap
                .main
                .offset({'left': pos.pageX, 'top': pos.pageY});

            typeof callback == 'function' && callback.apply(null, []);
        });
    }

    function show(selection) {
        if (queryMap && queryMap.main && selection) {
            stateMap.selection = selection;

            queryMap
                .main
                .css('display', 'inline-block');
            queryMap
                .main
                .css('visibility', 'hidden');

            reposition(selection, function () {
                queryMap
                    .main
                    .css('visibility', 'visible');
            });
        }
    };

    function hide() {
        if (queryMap && queryMap.main) {
            queryMap
                .main
                .hide();
        }
    };

    exports = {
        'show': show,
        'hide': hide,
        'destroy': destroy,
        'bootstrap': init,
        'on': eventEmitter.addEventHandler,
        'off': eventEmitter.removeEventHandler
    };

//    init();

    return exports;
};
