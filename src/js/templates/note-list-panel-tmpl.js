"use strict";

const strUtils = require('../utils/string-utils');

function url(s){
	return chrome.extension.getURL(s);
}

const deleteBtnIcon = url('img/icons/remove.png');

module.exports.main = () => `
<div class="docgaga-note-list-panel docgaga-note-list-panel-collapsed theme-lizzy">
	<div class="docgaga-note-list-wrapper">
        <div class="docgaga-note-list-menu">
          <ul>
            <li title="新的笔记" class="docgaga-note-list-menu-btn" data-role="new-note-btn">add</li>
          </ul>
        </div>
		<div class="docgaga-note-list-header">
			<div class="docgaga-note-list-title"></div>
			<a class="docgaga-note-list-panel-header-btn docgaga-note-list-panel-toggle-btn" title="汤圆笔记">笔</a>
		</div>
        <div class="docgaga-note-list-control-panel">
            <ul class="docgaga-note-list-tabs"></ul>
            <a class="docgaga-note-list-control-panel-toggle-btn">expand_more</a>
        </div>
		<div class="docgaga-note-list-main">
			<div class="docgaga-note-list-empty-info">
			</div>
			<ul class="docgaga-note-list">
			</ul>
		</div>
        <div class="docgaga-note-list-filter">
            <div data-role="advanced-filter">
               <div data-role="keyword-select-block">
                  <div data-role="block-title">关键词</div>
                  <div data-role="block-content">
                  </div>
               </div>
            </div>
            <div data-role="search-bar">
              <select data-role="scope-select" title="选择要查看的范围\n本页: 我在当前页面记录的笔记\n本站: 我在该网站记录的笔记\n所有: 我记录过的所有笔记">
                  <option value="page">本页</option>
                  <option value="site">本站</option>
                  <option value="all">所有</option>
              </select>
              <input data-role="search-input" title="搜索笔记、标记、关键词、标题、网址等" placeholder="搜索笔记、标题、关键词 ..."/>
              <a data-role="toggle-advanced" title="更多设置">keyboard_arrow_up</a>
            </div>
        </div>
		<div class="docgaga-note-list-footer">
			<div class="docgaga-note-list-footer-info"></div>
            <a class="docgaga-note-list-panel-footer-btn docgaga-note-list-panel-refresh-btn" data-role="refresh" title="刷新">refresh</a>
            <a class="docgaga-note-list-panel-footer-btn" data-role="filter" title="筛选">filter_list</a>
		</div>
	</div>
</div>
`;
//🔍
module.exports.listItem = (pk, title, icon, time, extraInfo, keywords) => `
<li data-pk="${pk}" class="docgaga-note-list-item">
  <div class="docgaga-note-list-item-title" title="${strUtils.escapeHTML(title.tooltip || title.text)}">
    <span data-role="icon" title="${strUtils.escapeHTML(icon.title)}" data-type="${icon.type}">${icon.iconfont}</span>
    <img data-role="icon" class="docgaga-note-list-item-icon" title="${strUtils.escapeHTML(icon.title)}" src="${icon.icon}"/>
    <span data-role="text">${strUtils.escapeHTML(title.text)}</span>
  </div>
  <span class="docgaga-note-list-item-delete-btn" data-pk="${pk}" title="删除">remove_circle_outline</span>
<!--  <img class="docgaga-note-list-item-delete-btn" data-pk="${pk}" title="删除" src="${deleteBtnIcon}"/> -->
  <div>
    <div data-role="keywords">${strUtils.escapeHTML(keywords.join(' | '))}</div>
    <div data-role="extra-info">${extraInfo.text || ''}</div>
    <div data-role="last-update-time" title="${time.time}">${strUtils.escapeHTML(time.timeStr)}</div>
  </div>
</li>
`;

module.exports.tab = (tab) => `
<li data-id="${tab.id}" title="${strUtils.escapeHTML(tab.name)}">
    <span data-role="icon" data-id="${tab.id}">${tab.iconfont}</span>
    <img data-role="icon" src="${chrome.extension.getURL(tab.icon)}"/>
    <span data-role="count">0</span>
</li>
`;

module.exports.extLink = (url, note, tooltip, name) => `
<a title="${strUtils.escapeHTML(tooltip || url)}" data-url="${strUtils.escapeHTML(url)}" data-noteId="${note.pk}" data-role="remote-open" target="_blank">${name}<span data-role="icon">open_in_new</span></a>
`;

module.exports.loginBtn = (link, linkName) => `
<a href="${link}" target="_blank" data-role="login-btn" title="去登录">${linkName || "登录"}</a>
`;
