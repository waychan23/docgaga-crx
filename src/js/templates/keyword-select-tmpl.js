"use strict";

var strUtils = require('../utils/string-utils');

module.exports.main = () => `
<div class="docgaga-keyword-select">
	<div class="docgaga-keyword-select-cand-list">
		<div data-role="header">
			<a data-role="close">clear</a>
			<span data-role="title">参考关键词</span>
		</div>
		<div data-role="info"></div>
		<ul></ul>
	</div>
	<div class="docgaga-keyword-select-list docgaga-keyword-select-list-collapsed">
		<div data-role="edit-keyword-container" style="width: 0; height: 0; display: none !important;"></div>
		<a data-role="toggle"></a>
		<ul>
			<li><input data-role="new-keyword" hidden=true><a data-role="add" title="添加关键词">add</a></li>
			<li data-role="tip"><span data-role="content">为笔记添加关键词，方便以后查找</span></li>
		</ul>
	</div>
	<div class="docgaga-keyword-select-error-info"><span data-role="content"></span></div>
</div>
`;

module.exports.listItem = (i) => `
<li class="docgaga-keyword-select-list-item"><span data-role="keyword">${strUtils.escapeHTML(i && i.object && i.object.keyword || '')}</span><a data-role="delete" title="删除">clear</a></li>
`;

module.exports.candListItem = (i) => `
<li title="点击选取:${ strUtils.escapeHTML(i && i.object && i.object.keyword || '')}" class="docgaga-keyword-select-cand-list-item">${strUtils.escapeHTML(i && i.object && i.object.keyword || '')}</li>
`;

module.exports.editInput = () => `
<input data-role="edit-keyword"/>
`;

module.exports.editConfirm = () => `
<a data-role="edit-confirm" title="确认更改">done</a>
`;

module.exports.editCancel = () => `
<a data-role="edit-cancel" title="取消更改">undo</a>
`;

module.exports.addConfirm = () => `
<a data-role="add-confirm" title="确认添加">done</a>
`;

module.exports.addCancel = () => `
<a data-role="add-cancel" title="取消">clear</a>
`;
