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
//		console.log('change-url');
//		console.log('in listener for "change-url" checkShouldLaunch: ', state);
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
//	console.debug('in listener for "boostrap", boostraping: ', state);
	sendResponse({ 'success': state.launched });
	return true;
});

msgService.listen('destroy', null, function(msg, sender, sendResponse){
	destroy();
//	console.debug('in listener for "destroy", boostraping: ', state);
	sendResponse({ 'success': !state.launched });
	return true;
});

setTimeout(function(){
	//as a fallback when 'change-url' event somehow not successfully dispatched
	if(state.init){
		checkShouldLaunch();
//		console.debug('init checShouldLaunch', state);
	}
}, 2000);

function bootstrap(force){
//	console.log('bootstraping ...:', force);
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
//setUpdatePolicy();

function onVisibilityChange(){
	var vis = !document.hidden;

	if(!state.init && !state.focus && vis && state.launched){
//		console.log('visibility change');
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
//			console.debug('in checkShouldLaunch boostraping: ', state);
		}else{
			state.shouldLaunch = false;
			destroy();
//			console.debug('in checkShouldLaunch destroying: ', state);
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
			//TODO delegate error to global notification center
			//console.warn(rs);
		}
	});
}

function checkRemoteOpen(){
	asap(function(){
		noteService.checkRemoteOpen(function(msg){
			if(msg && msg.noteId){
				noteListPanel.checkReady().then(function(rs){
					if(rs && rs.ready){
//						console.log('open: ', msg.noteId);
						notePanel.openNote(msg.noteId);
					}
				});
			}else{
//				console.log('hide ...');
				notePanel.hide();
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
//		console.log('hide');
	}
}

function onCreateNote(){
	notePanel.createNote();
}

function onSaveNoteSuccess(event){
	noteListPanel.refresh();
	notePanel.hide();
	noteListPanel.blink();
//	console.log('hide');
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

function setUpdatePolicy(){
	$(document).on('visibilitychange', function(){
		var vis = !document.hidden;

		if(!state.focus && vis){
			noteListPanel.refresh();
		}

		state.focus = vis;
	});

	setInterval(function(){
		if(state.focus){
			noteListPanel.refresh();
		}
	}, 60 * 1000 * 2);
}
