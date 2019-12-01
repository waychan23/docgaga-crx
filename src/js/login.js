"use strict";

const $ = require('jquery');
const utf8 = require('utf8');
const base64 = require('base-64');
const cr = require('./utils/chrome');
const auth = require('./utils/auth-utils');
const config = require('./conf/config');

function a(path){
	return config.apiUrl(null, '/docgaga'+path);
}

var apis = updateAPI(config.local);

config.on('update', function(conf){
	return $.extend(apis || {}, updateAPI(conf));
});

var pages = {
	'loginSuccess': cr.url('login-success.html')
};

var form = $('form')
		.on('keyup', function(event){ event.keyCode == 13 && submit(event); return false;})
		.on('submit', submit);

var btn = {
	'forgetPwd': form.find('a[data-role=forget-pwd-btn]'),
	'login': form.find('button[data-role=login-btn]'),
	'signup': form.find('button[data-role=to-signup-btn]')
};

var input = {
	'account': form.find('input[name=account]'),
	'password': form.find('input[name=password]')
};

var submiting = false;

$(function(){
	logout().catch(function(){
		window.close();
	});
});

function updateAPI(localConfig){
	return {
		'login': a('/user/login'),
		'logout': a('/user/logout')
	};
}

function logout(){
	var username, apiTicket;
	return auth.getLoginUser().then(function(rs){
		rs = rs || {};

		username = rs.username;
		apiTicket = rs.apiTicket;

		return (!username || !apiTicket)?true: new Promise(function(resolve, reject){
			$.ajax({
				url: apis.logout,
				type: 'get',
				dataType: 'json',
				beforeSend: function(req){
					req.setRequestHeader('x-username', username);
					req.setRequestHeader('x-api-ticket', apiTicket);
				},
				success: function(resp){
					resolve(resp);
				},
				error: function(a, b, c){
					console.error(a, b, c);
					reject(a);
				}
			});
		});
	}).then(function(resp){
//		return cr.clearProperties();
		return auth.logout();
	}).catch(function(err){
		console.error(err);
	});
}

function submit(event){
	if(submiting){
		return false;
	}

	submiting = true;

	var data = getFormData();

	if(!validate(data)){
		return false;
	}

	data.type = 'EXTENSION';

	$.ajax({
		'url': apis.login,
		'type': 'post',
		'dataType': 'json',
		'data': data,
		'success': function(resp){
			if(!resp || resp.error || !resp.success || !resp.result){
				submiting = false;
				alert(resp && resp.error && resp.error.msg || '登录失败');
				return;
			}
			if(resp.success && resp.result){
				applyUserInfo(resp.result).then(function(result){
					if(result){
						window.location.href = pages.loginSuccess;
					}
					throw "登录失败";
				}).catch(function(err){
//					alert('登录失败');
					submiting = false;
					console.error(err);
				});
			}
		},
		'error': function(a, b, c){
			submiting = false;
			console.error(a, b, c);
		}
	});

	event.preventDefault();

	return false;
}

function applyUserInfo(userInfo, callback){
	if(!userInfo || !userInfo.username || !userInfo.apiTicket){
		return Promise.reject('未登录');
	}

	return auth.login(userInfo);
}

function validate(data){
	var i, fields, f;

	data = data || {};

	if(!data.account){
		showErrorTip(input.account, '必须填写');
		return false;
	}else{
		showErrorTip(input.account);
	}

	if(!data.password){
		showErrorTip(input.password, '必须填写');
		return false;
	}else{
		showErrorTip(input.password);
	}

	return true;
}

function showErrorTip(target, msg){
	target.parent().find('.error-tip').text(msg && '('+msg+')' || '').show();
}

function getFormData(){
	var data = {};

	data.account = input.account.val().trim() || '';
	data.password = input.password.val().trim() || '';

	data.password = data.password? base64Encode(data.password): '';

	return data;
}

function base64Encode(str){
	return base64.encode(utf8.encode(str));
}
