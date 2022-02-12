function registerActivity(e) {
	// 1: if currently inactive, switch to active
	// 2: record time
}
// 3: on a ~1 minute interval timer, check if last activity time was > 3 minutes or whatever, and go inactive 

;['wheel','keydown','mousedown','mousemove','touchstart'].forEach(event => document.addEventListener(event, registerActivity))
window.addEventListener('focus', registerActivity)

let track_resize_2 = new ResizeTracker('width')

<!--/* trick indenter
with (View) (function($) { "use strict" //*/

var room
var renderPage = (page)=>{
	setEntityTitle(page)
	setEntityPath(page.parent)
	flag('canEdit', /u/.test(page.myPerms))
	$chatTextarea.disabled = !(page.createUserId==Req.uid || /c/.test(page.permissions[Req.uid] || page.permissions[0]));
	Nav.link("editpage/"+page.id, $pageEditLink)
	Nav.link("comments/"+page.id, $pageCommentsLink)
}

var lastSent = null;

addView('page', {
	// in this case, we sometimes make a request, and sometimes
	// load the page instantly because the chatroom is cached
	// so, call either `render` or `quick`
	// the function passed to quick will act like a simple view
	// with no `start` method (is called immediately)
	// DO NOT CALL BOTH FUNCTIONS!
	start: (id, query, render, quick)=>{
		var room = ChatRoom.rooms[id]
		if (room) {
			var z = room.pinned
			room.pinned = true
			quick(()=>{
				var page = room.page
				//ChatRoom.setViewing([page.id])
				room.show()
				room.pinned = z
				renderPage(page)
			})
		} else {
			//todo: maybe we can request the user list early too?
			// the problem is, if we create the room early,
			// we might get messages from long polling before
			// loading the initial messages :(
			return Req.read([
				{content: {ids: [id], IncludeAbout: ["votes","watches"]}},
				{comment: {parentIds: [id], limit: 30, reverse: true}},
				"comment.0values_pinned~Mpinned",//: {parentIds: [id]}},
				"user.0createUserId.0editUserId.1createUserId.1editUserId.2createUserId.2editUserId",
			], {
				//content: "name,parentId,type,createUserId,editUserId,createDate,editDate,permissions,id"
			}, (e, resp)=>{
				// todo: ok so we have 2 levels of error here
				// either the request fails somehow (e is set)
				// or, the page/whatever we're trying to access doesn't exist
				// this exists for pretty much every view/request type
				// so it would be good to handle it consistently
				if (!e && resp.content[0]) {
					resp.comment.reverse()
					render(resp.content[0], resp.comment, resp.Mpinned)
				} else
					render(null)
			}, true)
		}
	},
	className: 'page',
	splitView: true,
	render: (page, comments, pinned)=>{
		Act.newPageComments(page, comments)
		Act.redraw()
		//ChatRoom.setViewing([page.id])
		room = new ChatRoom(page.id, page)
		room.displayInitialMessages(comments, pinned) //todo: when page is edited, update pinned messages
		room.show()
		
		renderPage(page)
	},
	cleanUp: (type)=>{
		//$messageList.replaceChildren()
		if (room)
			room.hide() //so it's fucking possible for cleanup to get called TWICE if there's an error, sometimes.
		room = null
		flag('canEdit', false)
	},
	init: ()=>{
		function sendMessage() {
			var data = readInput(editingComment, !!editingComment)
			var room = ChatRoom.currentRoom
			if (room && data.content) {
				
				if (editingComment) {
					Req.editMessage(editingComment.id, editingComment.parentId, data.content, data.meta, (e)=>{
						if (e)
							alert("Editing comment failed")
					})
					cancelEdit()
				} else {
					var old = data
					Req.sendMessage(room.id, data.content, data.meta, (e, resp)=>{
						if (e) {
							//error sending message
							writeInput(old)
						} else {
							lastSent = resp.id;
						}
					})
					$chatTextarea.value = "" //hack?
					updateChatTextareaSize()
				}
			} else if (editingComment) {
				var resp = confirm("Are you sure you want to delete this message?\n"+editingComment.content)
				if (resp) {
					Req.deleteMessage(editingComment.id, (e, resp) => {
						//
					})
					$chatTextarea.focus() //need more of this
				}
				cancelEdit()
			}
		}
		
		$chatTextarea.onkeydown = (e)=>{
			if (e.keyCode==38 && $chatTextarea.value=="") { // up arrow
				if (lastSent)
					editComment(lastSent)
			}
		}
		$chatTextarea.onkeypress = (e)=>{
			if (!e.shiftKey && e.keyCode == 13) { // enter
				e.preventDefault()
				sendMessage()
			}
		}
		// TODO: make sure this is ready when the long poller starts!
		// right now it PROBABLY will be but that isn't certain
		// the long poller could technically start before onload
		ChatRoom.global = new ChatRoom(-1)
		
		$hideGlobalStatusButton.onclick = (e)=>{
			if ($hideGlobalStatusButton.disabled)
				return
			$hideGlobalStatusButton.disabled = true
			ChatRoom.global.toggleHiding(()=>{
				$hideGlobalStatusButton.disabled = false
			})
		}
		
		$chatCancelEdit.onclick = ()=>{
			cancelEdit()
		}
		// todo: global escape handler?
		document.addEventListener('keydown', (e)=>{
			if (e.keyCode == 27) {
				cancelEditMode()
				cancelEdit()
			}
		})
		document.addEventListener('click', (e)=>{
			if (View.flags.chatEdit) {
				View.flag('chatEdit', false)
				var element = e.target
				while (element && element instanceof HTMLElement) {
					if (element.tagName == 'MESSAGE-PART') {
						var id = element.dataset.id
						if (id)
							editComment(+id, element)
						break
					}
					element = element.parentNode
				}
			}
		}, true)
		
		let updateChatTextareaSize = ()=>{
			$chatTextarea.style.height = ''
			if (ChatRoom.currentRoom) {
				var oldBottom = ChatRoom.currentRoom.scroller.scrollBottom
			}
			var height = $chatTextarea.scrollHeight
			$chatTextarea.parentNode.style.height = $chatTextarea.style.height = height+1+"px"
			if (ChatRoom.currentRoom) {
				ChatRoom.currentRoom.scroller.ignoreScroll = true
				ChatRoom.currentRoom.scroller.scrollBottom = oldBottom
			}
		}
		updateChatTextareaSize()
		$chatTextarea.addEventListener('input', updateChatTextareaSize)
		track_resize_2.add($chatTextarea, updateChatTextareaSize)
	}
})

function readInput(old, edit) {
	let data = {
		meta: old ? old.meta : {},
		content: $chatTextarea.value,
	}
	
	if ($chatMarkupSelect.checked)
		data.meta.m = Settings.values.chat_markup
	else
		data.meta.m = 'plaintext'
	if (!edit) {
		if (Req.me)
			data.meta.a = Req.me.avatar
		if (Settings.values.nickname)
			data.meta.n = String(Settings.values.nickname).substr(0, 50).replace(/\n/g, "  ")
		if (Settings.values.big_avatar=='on' && Settings.values.big_avatar_id)
			data.meta.big = Settings.values.big_avatar_id
	}
	
	return data
}

function writeInput(data) {
	$chatTextarea.value = data.content || ""
	$chatMarkupSelect.checked = data.meta.m == Settings.values.chat_markup
}

var preEdit = null
window.editingComment = null

$.editComment = editComment //HACK
function editComment(id) {
	if (editingComment)
		cancelEdit()
	Req.getComment(id, (comment)=>{
		if (!comment) return
		if (editingComment)
			cancelEdit()
		cancelEditMode()
		preEdit = readInput()
		editingComment = comment
		writeInput(comment)
		View.flag('chatEditing', true)
		$chatTextarea.focus()
	})
}

function cancelEdit() {
	if (editingComment) {
		editingComment = null
		View.flag('chatEditing', false)
		writeInput(preEdit)
	}
}

function cancelEditMode() {
	View.flag('chatEdit', false)
}

<!--/*
}(window)) //*/

// when joining a room:
// - create the ChatRoom object
// - add this room to lastListeners
// - add status in this room
// - remove status from prev room(s) (if exists)
// - refresh long poller
// - start listening for posted messages
// - request initial messages

// when leaving a room:
// - remove status from room
// - refresh long poller IF we aren't switching to another chat room
//
