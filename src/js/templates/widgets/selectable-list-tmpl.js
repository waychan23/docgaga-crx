"use strict";

module.exports.main = () => `
<ul class="docgaga-ui-selectable-list">
</ul>
`;

module.exports.listItem = (i) => `
<li class="docgaga-ui-selectable-list-item" data-id="${i.id}" data-value="${i.value}" title="${i.desc || i.name || i.id}">
<img data-role="icon" ${i.icon?'':'hidden'} src="${i.icon?chrome.extension.getURL(i.icon):''}"/>
<span data-role="icon" data-id="${i.id}">${i.iconfont}</span>
<span data-role="content">${i.dom && typeof i.dom == 'function' && i.dom(i) || i.dom || i.name || '-' }</span>
</li>
`;
