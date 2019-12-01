"use strict";

var $ = require('jquery');
var urlUtils = require('./utils/url-utils');
var authUtils = require('./utils/auth-utils');
var config = require('./conf/config');

var INFO = {
	'LOGOUT_IN_PROGRESS': '正在退出登录...',
	'LOGOUT_DONE': '已经退出登录',
	'LOGOUT_ERROR': '退出登录失败',
	'LOGIN_TIMEOUT': '登录超时',
	'LOGIN_ALREADY_IN_PROGRESS': '登录窗口已打开，请前往操作',
	'LOGIN_IN_PROGRESS': '登录中...',
	'LOGIN_ERROR': '登录失败，请重试',
	'LOGIN_EXPIRED': '登录信息已过期，请重新登录',
	'LOGIN_SUCCESS': '登录成功，正在自动关闭该页面',
	'PAGE_ERROR': '程序出错，请关闭页面重试',
	'PAGE_LOADING': '页面加载中...',
	'WELCOME': '欢迎使用 - 汤圆笔记浏览器插件',
	'CUR_USER': function(username){ return '当前用户: '+username; }
};

var WAIT_TIME = 1000 * 60 * 5;
var WAIT_TIME_BEFORE_CLOSE = 300;
var CHECK_LOGIN_INTERVAL = 1000 * 6;
var CHECK_WIN_CLOSE_INTERVAL = 1500;

var INFO_TEXT_COLOR = {
	'info': '#0000EE',
	'error': '#FF2200'
};

var buttons = $("#buttons");
var loginBtn = $("#login-btn");
var logoutBtn = $("#logout-btn");
var signupBtn = $("#signup-btn");
var infoEle = $("#info");
var info = {
	text: function(text, type){
		type = type || 'info';
		
		if(!INFO_TEXT_COLOR[type]){
			type = 'info';
		}

		infoEle.css({ 'color': INFO_TEXT_COLOR[type] })
			.text(text || '');
	}
};

var resultWin;
var timer;
var curUser;
var state = {
	ticket: null,
	polling: false,
	startCheckTime: 0
};

var endpoint;

$(window).on('unload', function(){
	if(resultWin && !resultWin.closed){
		resultWin.close();
	}
});

initConfig();

config.on('update', initConfig);

init();

function initConfig(cf){
	endpoint = $.extend({}, cf? cf.endpoint: config.local.endpoint);
	
	var authUri = endpoint.auth;
	
	endpoint.auth = function(query){ return urlUtils.composeUri(authUri, query); };
}

function init(){
	info.text(INFO.PAGE_LOADING);
	authUtils.getLoginUser('detail', function(error, result){
		if(error){
			info.text(INFO.PAGE_ERROR, 'error');
			return;
		}
		if(result){
			curUser = result;
			initDom(true);
		}else{
			initDom(false);
		}
		
		initEvents();
	});
}

function initDom(login){
	if(login){
		info.text(INFO.CUR_USER(curUser.username));
		logoutBtn.show();
		loginBtn.hide();
		signupBtn.hide();
	}else{
		info.text(INFO.WELCOME);
		logoutBtn.hide();
		loginBtn.show();
		signupBtn.show();
	}

	buttons.show();
}

function initEvents(){
	loginBtn.on('click', function(){
		if(resultWin && !resultWin.closed){
			info.text(INFO.LOGIN_ALREADY_IN_PROGRESS);
			return;
		}
		
		state = {
			ticket: null,
			polling: false,
			startCheckTime: 0
		};
		
		requestLoginTicket();
	});

	logoutBtn.on('click', function(){
		if(!curUser){
			return;
		}
		
		state.polling = false;

		if(resultWin && !resultWin.closed){
			resultWin.close();
		}
		info.text(INFO.LOGOUT_IN_PROGRESS);
		
		authUtils.logout();
		
		$.ajax({
			url: endpoint.logout,
			data: { ticket: curUser.loginTicket },
			beforeSend: function(xhr){
				xhr.setRequestHeader('x-api-ticket', curUser.apiTicket);
			},
			success: function(){
				info.text(INFO.LOGOUT_DONE);
				initDom();
			},
			error: function(err){
				console.error(err);
				info.text(INFO.LOGOUT_ERROR, 'error');
				initDom();
			}
		});
	});

	signupBtn.on('click', function(){
		window.open(config.local.docgagaSiteInfo.endpoint.signupPage);
	});
}

function requestLoginTicket(ticket){
	var query = {};

	if(ticket){
		query.ticket = ticket;
	}
	
	$.ajax({
		url: endpoint.login,
		data: query,
		success: function(resp){
			if(!resp.ticket && !resp.loginInfo){
				console.error('response.ticket and response.loginInfo are empty');
			}
			if(ticket && resp.ticket){
				info.text(INFO.LOGIN_ERROR);
				state.polling = false;
				window.clearInterval(timer);
				return;
			}
			if(resp.ticket){
				state.ticket = resp.ticket;
				requestLogin();
				info.text(INFO.LOGIN_IN_PROGRESS);
			}else if(resp.loginInfo){
				var loginInfo = resp.loginInfo;

				loginInfo.loginTicket = ticket;
				
				handleLoginInfo(loginInfo, function(){
					window.setTimeout(function(){
						window.close();
					}, WAIT_TIME_BEFORE_CLOSE);
				});
				info.text(INFO.LOGIN_SUCCESS);
				state.polling = false;
				window.clearInterval(timer);
			}
		}
	});
}

function requestLogin(){
	if(!state.ticket){
		info.text(INFO.LOGIN_ERROR, 'error');
		return;
	}

	var authUrl = endpoint.auth({ ticket: state.ticket });

	resultWin = window.open(authUrl, '_blank');

	if(timer){
		window.clearInterval(timer);
	}
	
	timer = window.setInterval(function(){
		var t = new Date().getTime();

		if(resultWin.closed && state.polling){
			window.clearInterval(timer);
			check();
			state.polling = false;
		}else{
			if(t - state.startCheckTime >= WAIT_TIME){
				state.polling = false;
				info.text(INFO.LOGIN_TIMEOUT);
				if(resultWin && !resultWin.closed){
					resultWin.close();
				}
			}else{
				
			}
		}
	}, CHECK_WIN_CLOSE_INTERVAL);

	checkLogin();
}

function checkLogin(){
	state.startCheckTime = new Date().getTime();
	state.polling = true;
	state.pollInteval = CHECK_LOGIN_INTERVAL;
}

function check(){
	if(!state.ticket){
		info.text(INFO.LOGIN_ERROR, 'error');
		return;
	}
	$.ajax({
		url: endpoint.check,
		data: { ticket: state.ticket },
		success: function(resp){
			if(!resp || !resp.state){
				console.error('resp or resp.state is empty');
				info.text(INFO.LOGIN_ERROR, 'error');
				state.polling = false;
				return;
			}
			if(resp.error){
				console.error('error:', resp.error);
				info.text(INFO.LOGIN_ERROR, 'error');
				state.polling = false;
				return;
			}
			
			var t;
			
			if(resp.state == 'pending'){
				if(state.polling){
					t = new Date().getTime();
					if(t - state.startCheckTime > WAIT_TIME){
						info.text(INFO.LOGIN_TIMEOUT);
					}else{
						if(resultWin && !resultWin.closed){
							state.pollInteval = Math.floor(state.pollInteval * 1.2);
						}
						window.setTimeout(check, state.pollInteval);
						return;
					}
				}else if(!resultWin || resultWin.closed){
					info.text(INFO.LOGIN_ERROR, 'error');
				}
			}else if(resp.state == 'expired'){
				info.text(INFO.LOGIN_EXPIRED);
			}else if(resp.state == 'login'){
				requestLoginTicket(state.ticket);
			}else{
				console.error('unkown state: ', resp.state);
				info.text(INFO.LOGIN_ERROR, 'error');
			}

			state.polling = false;
			window.clearInterval(timer);
		},
		error: function(err){
			console.error(err);
			info.text(INFO.LOGIN_ERROR, 'error');
		}
	});
}

function handleLoginInfo(loginInfo, callback){
	authUtils.saveLoginInfo(loginInfo, function(error){
		if(error){
			console.error(error);
			alert('登录信息保存失败，请重试');
			return;
		}
		if(typeof callback == 'function'){
			callback.call();
		}
	});
}
