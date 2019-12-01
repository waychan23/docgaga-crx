"use strict";

const config = require('../conf/config');

function changeOrigin(){
	config.getOrigin().then(function(old){
		old = old || '';

		var origin = window.prompt('请输入插件服务器域名和端口，默认: '+config.def.origin, old);
		
		origin = origin && origin.trim() || '';

		if(origin && !/^([A-z0-9\-]+\.)*([A-z0-9]+):[\d]{2,5}$/.test(origin)){
			alert('输入有误');
		}else{
			if(origin){
				config.setOrigin(origin).then(function(rs){
					alert('修改成功');
				}).catch(function(error){
					alert('修改失败');
				});
			}
		}
		
	});
}

function changeAuthOrigin(){
	config.getAuthOrigin().then(function(old){
		old = old || '';

		var origin = window.prompt('请输入认证服务器域名和端口，默认: '+config.def.authOrigin, old);
		
		origin = origin && origin.trim() || '';

		if(origin && !/^([A-z0-9\-]+\.)*([A-z0-9]+):[\d]{2,5}$/.test(origin)){
			alert('输入有误');
		}else{
			if(origin){
				config.setAuthOrigin(origin).then(function(rs){
					alert('修改成功');
				}).catch(function(error){
					alert('修改失败');
				});
			}
		}
		
	});
}

module.exports = {
	'changeOrigin': changeOrigin,
	'changeAuthOrigin': changeAuthOrigin
};
