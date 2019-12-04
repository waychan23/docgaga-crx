const $ = require('jquery');
const Settings = require('./settings'),
	SETTING = Settings.DocGagaSettings.SETTING,
	settings = Settings(),
	aclUtils = require('./utils/acl-utils');

const ContentSelector = require('./components/content-selector'),
      OpMenu = require('./components/op-menu'),
	  NotePanel = require('./components/note-panel'),
	  NoteListPanel = require('./components/note-list-panel'),
	  store = {
		  'keyword': require('./storage/keyword-server-store')(),
		  'noteItem': require('./storage/note-item-server-store')()
	  },
	  noteService = require('./services/note-service'),
	  msgService = require('./services/msg-service'),
	  asap = require('./utils/asap');

const contentSelector = new ContentSelector(),
      opMenu = new OpMenu({
		  'btns': [
			  {
				  'btnId': 'docgaga-note-btn',
				  'name': '记',
				  'handler': noteHandler,
				  'hideAfter': true
			  }
		  ]
      }),
	  notePanel = new NotePanel({
		  'store': {
			  'noteItem': store.noteItem,
			  'keyword': store.keyword
		  }
	  }),
	  noteListPanel = new NoteListPanel({
		  'store': {
			  'noteItem': store.noteItem,
			  'keyword': store.keyword
		  }
	  });


var state = {
	shouldLaunch: false,
	launched: false,
	focus: true,
	init: true
};

msgService.listen('change-url', null , function(){
	if(!document.hidden){
		state.init = false;
		checkShouldLaunch();
	}
	return true;
});

msgService.listen('check-launched', null, function(msg, sender, sendResponse){
	sendResponse({ 'launched': state.launched });
	return true;
});

msgService.listen('bootstrap', null, function(msg, sender, sendResponse){
	bootstrap('force');
	sendResponse({ 'success': state.launched });
	return true;
});

msgService.listen('destroy', null, function(msg, sender, sendResponse){
	destroy();
	sendResponse({ 'success': !state.launched });
	return true;
});

setTimeout(function(){
	//as a fallback when 'change-url' event somehow not successfully dispatched
	if(state.init){
		checkShouldLaunch();
	}
}, 2000);

function bootstrap(force){
	if(!state.shouldLaunch && !force){
		return;
	}

	if(state.launched){
		checkAutoSearch();
		checkRemoteOpen();
		return;
	}

	[contentSelector, opMenu, notePanel, noteListPanel].forEach(function(component){
		component.bootstrap();
	});

	contentSelector.on('selectText', onSelectText);

	noteListPanel.on('note-open', onNoteOpen);

	notePanel.on('remote-note-open', onNotePanelOpenRemoteNote);

	noteListPanel.on('remote-note-open', onNoteListOpenRemoteNote);

	noteListPanel.on('delete-success', onNoteListDeleteNoteSuccess);

	noteListPanel.on('create-note', onCreateNote);

	noteListPanel.on('focus', onNoteListPanelFocused);

	notePanel.on('save-success', onSaveNoteSuccess);

	notePanel.on('save-error', onSaveNoteError);

	notePanel.on('delete-success', onNotePanelDeleteNoteSuccess);

	notePanel.on('focus', onNotePanelFocused);

	$(document.body).on('mouseup', onMouseUp);

	$(document).on('visibilitychange', onVisibilityChange);

	checkAutoOpenNoteList();
	checkAutoSearch();

	checkRemoteOpen();

	state.launched = true;
}

function destroy(){
	if(!state.launched){
		return;
	}

	$(document).off('visibilitychange', onVisibilityChange);

	$(document.body).off('mouseup', onMouseUp);

	notePanel.off('delete-success', onNotePanelDeleteNoteSuccess);

	notePanel.off('save-error', onSaveNoteError);

	notePanel.off('save-success', onSaveNoteSuccess);

	noteListPanel.off('focus', onNoteListPanelFocused);

	noteListPanel.off('create-note', onCreateNote);

	noteListPanel.off('delete-success', onNoteListDeleteNoteSuccess);

	noteListPanel.off('remote-note-open', onNoteListOpenRemoteNote);

	notePanel.off('focus', onNotePanelFocused);

	notePanel.off('remote-note-open', onNotePanelOpenRemoteNote);

	noteListPanel.off('note-open', onNoteOpen);

	contentSelector.off('selectText', onSelectText);

	[noteListPanel, notePanel, opMenu, contentSelector].forEach(function(component){
		component.destroy();
	});

	state.launched = false;
}

function onVisibilityChange(){
	var vis = !document.hidden;

	// if(!state.init && !state.focus && vis && state.launched){
	if(!state.focus && vis && state.launched){
		checkRemoteOpen();
	}

	state.focus = vis;
}

function onMouseUp(event){
	if(event.isDefaultPrevented()){
		return;
	}
	opMenu.hide();
	contentSelector.clear();
	contentSelector.selectHandler.apply(contentSelector, [event]);
}

function checkShouldLaunch(){
	aclUtils.checkShouldLaunch().then(function(yes){
		if(yes){
			state.shouldLaunch = true;
			bootstrap();
		}else{
			state.shouldLaunch = false;
			destroy();
		}
	});
}

function checkAutoOpenNoteList(){
	settings.requireSettings([
		{ name: SETTING.AUTO_OPEN_NOTE_LIST, value: true }
	]).then(function(rs){
		if(rs.success){
			noteListPanel.toggle(true);
		}
	});
}

function checkAutoSearch(){
	settings.requireSettings([
		{ name: SETTING.AUTO_SEARCH_NOTE, value: true }
	]).then(function(rs){
		if(rs.success){
			noteListPanel.refresh();
		}else{
			console.error(rs);
		}
	});
}

function checkRemoteOpen(){
	asap(function(){
		noteService.checkRemoteOpen(function(msg){
			if(msg && msg.noteId){
				if(!notePanel.isOpen() || window.confirm('【汤圆笔记】您从其他页面打开了一个笔记，但是当前页面有已打开的笔记，可能有未保存的修改，是否放弃这些修改？')){
					noteListPanel.checkReady().then(function(rs){
						if(rs && rs.ready){
							notePanel.openNote(msg.noteId);
						}
					});
				}
			}
		});
	});
}

function onNoteOpen(event){
	notePanel.openNote(event.note.pk);
}

function onNotePanelOpenRemoteNote(event){
	noteService.openNoteInPage(event.url, event.noteId);
}

function onNoteListOpenRemoteNote(event){
	noteService.openNoteInPage(event.url, event.noteId);
}

function onNoteListDeleteNoteSuccess(event){
	var note = notePanel.getNote();
	if((note && note.pk) == event.pk){
		notePanel.hide();
	}
}

function onCreateNote(){
	notePanel.createNote();
}

function onSaveNoteSuccess(event){
	noteListPanel.refresh();
	notePanel.hide();
	noteListPanel.blink();
}

function onSaveNoteError(event){
	noteListPanel.refresh();
	alert('保存失败');
}

function onNotePanelDeleteNoteSuccess(event){
	noteListPanel.refresh();
}

function onSelectText(event){
    var selection = event.selection;
    if(!selection){
		return;
    }
    opMenu.show(selection);
}

function onNoteListPanelFocused(event){
	var noteListPanelZ = noteListPanel.getZIndex(),
		notePanelZ = notePanel.getZIndex();

	if(noteListPanelZ < notePanelZ){
		noteListPanel.setZIndex(notePanelZ);
		notePanel.setZIndex(noteListPanelZ);
	}else if(noteListPanelZ == notePanelZ){
		noteListPanel.setZIndex(noteListPanelZ + 1);
	}
}

function onNotePanelFocused(event){
	var noteListPanelZ = noteListPanel.getZIndex(),
		notePanelZ = notePanel.getZIndex();

	if(noteListPanelZ > notePanelZ){
		noteListPanel.setZIndex(notePanelZ);
		notePanel.setZIndex(noteListPanelZ);
	}else if(noteListPanelZ == notePanelZ){
		notePanel.setZIndex(notePanelZ + 1);
	}
}

function noteHandler(event, selection){
	if(!selection){
		return;
	}
	notePanel.show(selection);
    event.stopPropagation();
}
