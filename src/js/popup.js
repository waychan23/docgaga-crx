"use strict";

require('./conf/runtime').setEnv('popup');

const $ = require('jquery');
const cr = require('./utils/chrome');
const auth = require('./utils/auth-utils');
const config = require('./conf/config');
const setting = require('./utils/setting-utils');
const userUtils = require('./utils/user-utils');
const msgService = require('./services/msg-service');
const nodeStore = require('./storage/note-item-server-store')()

window.onload = function(){

	var pages = updatePages(config.local);

	var btn = {};
	var domMap = {};

	var user,
		binded = false;

	btn.login = $('a[data-role=to-login-btn]')
		.on('click', gotoLogin);

	btn.signup = $('a[data-role=to-signup-btn]')
		.on('click', gotoSignup);

	btn.notebook = $('a[data-role=to-notebook-btn]')
		.on('click', gotoNotebook);

	btn.logout = $('a[data-role=logout-btn]')
		.on('click', gotoLogin);

	btn.setting = $('a[data-role=setting-btn]')
		.on('click', gotoSettings);

	btn.devConfig = $("a[data-role=dev-config-btn]")
		.on('click', setting.changeOrigin);

	btn.authConfig = $("a[data-role=auth-config-btn]")
		.on('click', setting.changeAuthOrigin);
	
	if(config.env == 'development' && btn.devConfig){
		btn.devConfig.addClass('shown').show();
		btn.authConfig.addClass('shown').show();
	}else{
		btn.devConfig.removeClass('shown').hide();
		btn.authConfig.removeClass('shown').hide();
	}

	config.on('update', function(conf){
		return $.extend(pages || {}, updatePages(conf));
	});

	domMap.content = $('.content');
	domMap.userInfo = domMap.content.find('.info-block[data-role=user-info][data-loggedIn=yes]');
	domMap.noUserInfo = domMap.content.find('.info-block[data-role=user-info][data-loggedIn=no]');
	domMap.accessibilityGrantedInfo = domMap.content.find('.info-block[data-role=accessibility-info][data-accessibility=yes]').hide();
	domMap.noAccessibilityInfo = domMap.content.find('.info-block[data-role=accessibility-info][data-accessibility=no]').hide();
	domMap.avartar = domMap.userInfo.find('.avartar');
	domMap.username = domMap.userInfo.find('.username');
	domMap.noteCount = domMap.userInfo.find('.note-count *[data-role=info-value]');
	domMap.userTitle = domMap.userInfo.find('.user-title *[data-role=info-value]');
	domMap.tmpBlockBtn = domMap.accessibilityGrantedInfo.find('.accessibility-op-btn[data-role=tmp-block-btn]');
	domMap.permBlockBtn = domMap.accessibilityGrantedInfo.find('.accessibility-op-btn[data-role=perm-block-btn]');
	domMap.tmpAllowBtn = domMap.noAccessibilityInfo.find('.accessibility-op-btn[data-role=tmp-allow-btn]');
	domMap.permAllowBtn = domMap.noAccessibilityInfo.find('.accessibility-op-btn[data-role=perm-allow-btn]');
	domMap.allowScopeInfo = domMap.content.find('.info-block[data-role=ac-scope-info][data-accessibility=no]').hide();
	domMap.blockScopeInfo = domMap.content.find('.info-block[data-role=ac-scope-info][data-accessibility=yes]').hide();
	domMap.allowSiteBtn = domMap.allowScopeInfo.find('.ac-scope-op-btn[data-role=site-scope-btn]');
	domMap.allowPageBtn = domMap.allowScopeInfo.find('.ac-scope-op-btn[data-role=page-scope-btn]');
	domMap.cancelAllowBtn = domMap.allowScopeInfo.find('.ac-scope-op-btn[data-role=cancel-btn]');
	domMap.blockSiteBtn = domMap.blockScopeInfo.find('.ac-scope-op-btn[data-role=site-scope-btn]');
	domMap.blockPageBtn = domMap.blockScopeInfo.find('.ac-scope-op-btn[data-role=page-scope-btn]');
	domMap.cancelBlockBtn = domMap.blockScopeInfo.find('.ac-scope-op-btn[data-role=cancel-btn]');

	domMap.tmpAllowBtn.on('click', function(){
		msgService.dispatch('allow-cur-page', { persistent: false }, function(rs){
			checkAccessibility();
		});
	});

	domMap.tmpBlockBtn.on('click', function(){
		msgService.dispatch('block-cur-page', { persistent: false }, function(rs){
			checkAccessibility();
		});
	});

	domMap.permAllowBtn.on('click', function(){
		domMap.noAccessibilityInfo.hide();
		domMap.allowScopeInfo.show();
	});

	domMap.permBlockBtn.on('click', function(){
		domMap.accessibilityGrantedInfo.hide();
		domMap.blockScopeInfo.show();
	});

	domMap.allowSiteBtn.on('click', function(){
		msgService.dispatch('allow-cur-page', { persistent: true, type: 'site' }, function(rs){
			checkAccessibility();
		});
	});

	domMap.allowPageBtn.on('click', function(){
		msgService.dispatch('block-cur-page', { persistent: true, type: 'page' }, function(rs){
			checkAccessibility();
		});
	});

	domMap.blockSiteBtn.on('click', function(){
		msgService.dispatch('block-cur-page', { persistent: true, type: 'site' }, function(rs){
			checkAccessibility();
		});
	});

	domMap.blockPageBtn.on('click', function(){
		msgService.dispatch('block-cur-page', { persistent: true, type: 'page' }, function(rs){
			checkAccessibility();
		});
	});

	domMap.cancelAllowBtn.on('click', function(){
		domMap.allowScopeInfo.hide();
		domMap.noAccessibilityInfo.show();
	});

	domMap.cancelBlockBtn.on('click', function(){
		domMap.blockScopeInfo.hide();
		domMap.accessibilityGrantedInfo.show();
	});

	checkLogin();
	checkAccessibility();

	function updatePages(localConfig){
		return {
			'loginPage': localConfig.endpoint.loginPage,
			'settingPage': localConfig.endpoint.settingPage,
			'signupPage': localConfig.docgagaSiteInfo.endpoint.signupPage,
			'noteBookPage': localConfig.links.notebook
		};
	}

	function checkLogin(){
		auth.getLoginUser().then(function(usr){
			user = usr;
			updateUserInfo();
		});
	}

	function checkAccessibility(){
		domMap.allowScopeInfo.hide();
		domMap.blockScopeInfo.hide();
		msgService.dispatch('get-active-page-accessibility', {}, function(rs){
			if(!rs || rs.error || (typeof rs.accessible != 'boolean')){
				domMap.accessibilityGrantedInfo.hide();
				domMap.noAccessibilityInfo.hide();
			}else if(rs.accessible){
				domMap.noAccessibilityInfo.hide();
				domMap.accessibilityGrantedInfo.show();
			}else{
				domMap.accessibilityGrantedInfo.hide();
				domMap.noAccessibilityInfo.show();
			}
			return true;
		});
	}

	function updateUserInfo(){
		if(!user){
			btn.signup.addClass('shown').show();
			btn.logout.removeClass('shown').hide();
			btn.setting.removeClass('shown').hide();
			domMap.noUserInfo.show();
			domMap.userInfo.hide();
			return;
		}

		btn.signup.removeClass('shown').hide();
		btn.logout.addClass('shown').show();
		btn.setting.addClass('shown').show()

		domMap.noUserInfo.hide();
		domMap.userInfo.show();
		domMap.avartar.attr('src', user.avartar || 'img/default-avartar.jpg');
		domMap.username.text(user.username || '???');
		domMap.noteCount.text('...');
		domMap.userTitle.text('');

		nodeStore.count().then(function(count){
			if(count !== null && count !== undefined){
				domMap.noteCount.text(count);
				domMap.userTitle.text(userUtils.getTitleByNoteCount(count));
				return true;
			} else {
				domMap.noteCount.text('?');
				domMap.userTitle.text('暂时无法获取笔记数量');
			}
		}).catch(function(e){
			sendResponse({ error: e });
		});
	}

	function gotoSettings(){
		cr.openTab(pages.settingPage);	
	}

	function gotoLogin(){
		//	window.open(pages.loginPage);
		cr.openTab(pages.loginPage);
	}

	function gotoSignup(){
		cr.openTab(pages.signupPage);
	}

	function gotoNotebook(){
		cr.openTab(pages.noteBookPage);
	}
};
