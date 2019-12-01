module.exports.main = () =>
`<div class="docgaga-note-panel theme-lizzy">
	<div class="docgaga-note-panel-wrapper">
		<div class="docgaga-note-panel-header">
			<span data-role="docgaga-note-panel-title-icon">bookmark</span>
			<span data-role="docgaga-note-panel-title">汤圆笔记</span>
			<a title="放弃笔记并关闭窗口" class="docgaga-note-panel-layout-btn docgaga-note-panel-close-btn">clear</a>
			<a title="最大化窗口" class="docgaga-note-panel-layout-btn docgaga-note-panel-max-btn">fullscreen</a>
			<a title="置顶窗口" class="docgaga-note-panel-layout-btn docgaga-note-panel-set-top-btn">vertical_align_top</a>
            <a title="定位文本位置" class="docgaga-note-panel-layout-btn docgaga-note-panel-locate-btn">place</a>
		</div>
		<div class="docgaga-note-panel-main docgaga-note-panel-text-collapsed">
			<div class="docgaga-note-panel-text-panel">
                <a class="docgaga-note-panel-text-toggle-btn">
				    <span class="docgaga-note-panel-text-title">标记内容:</span>
                </a>
				<div class="docgaga-note-panel-text-content">
				</div>
			</div>
			<div class="docgaga-note-panel-note-panel">
                <div class="docgaga-note-panel-note-title">
                    <span>类型:</span>
                    <div class="docgaga-note-panel-type-select-list">
                    </div>
                </div>
                
				<textarea class="docgaga-note-panel-textarea" placeholder="在此输入笔记内容"></textarea>
			</div>
		</div>
        <div class="docgaga-note-panel-keyword-select"></div>
		<div class="docgaga-note-panel-footer">
            <div data-role="info"></div>
			<a title="保存" class="docgaga-note-panel-op-btn docgaga-note-panel-save-btn">保存</a>
            <a title="删除笔记" class="docgaga-note-panel-op-btn docgaga-note-panel-delete-btn">删除</a>
		</div>
	</div>
</div>`;

module.exports.cateOption = (cate) =>`
<option value="${cate.id}">${cate.name}</option>
`
;
