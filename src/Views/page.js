function register_activity(e) {
	// 1: if currently inactive, switch to active
	// 2: record time
}
// 3: on a ~1 minute interval timer, check if last activity time was > 3 minutes or whatever, and go inactive

//;['wheel','keydown','mousedown','mousemove','touchstart'].forEach(event => document.addEventListener(event, registerActivity))
//window.addEventListener('focus', registerActivity)

let track_resize_2 = new ResizeTracker('width')

<!--/* trick indenter
with (View) (function($) { "use strict" //*/

let room
let render_page = (page)=>{
	setEntityTitle(page)
	setEntityPath(page.parent)
	flag('canEdit', /u/.test(page.myPerms))
	$chatTextarea.disabled = !(page.createUserId==Req.uid || /c/.test(page.permissions[Req.uid] || page.permissions[0]));
	Nav.link("editpage/"+page.id, $pageEditLink)
	Nav.link("comments/"+page.id, $pageCommentsLink)
}

let last_sent = null;

addView('page', {
	// in this case, we sometimes make a request, and sometimes
	// load the page instantly because the chatroom is cached
	// so, call either `render` or `quick`
	// the function passed to quick will act like a simple view
	// with no `start` method (is called immediately)
	// DO NOT CALL BOTH FUNCTIONS!
	start(id, query, render, quick) {
		let room = ChatRoom.rooms[id]
		if (room) {
			let z = room.pinned
			room.pinned = true
			quick(()=>{
				let page = room.page
				//ChatRoom.setViewing([page.id])
				room.show()
				room.pinned = z
				render_page(page)
			})
		} else {
			//todo: maybe we can request the user list early too?
			// the problem is, if we create the room early,
			// we might get messages from long polling before
			// loading the initial messages :(
			return Req.read([
				['content', {ids: [id], IncludeAbout: ["votes","watches"]}],
				['comment', {parentIds: [id], limit: 30, reverse: true}],
				['comment.0values_pinned~Mpinned'],//: {parentIds: [id]}},
				['user.0createUserId.0editUserId.1createUserId.1editUserId.2createUserId.2editUserId'],
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
	render(page, comments, pinned) {
		Act.newPageComments(page, comments)
		Act.redraw()
		//ChatRoom.setViewing([page.id])
		room = new ChatRoom(page.id, page)
		room.displayInitialMessages(comments, pinned) //todo: when page is edited, update pinned messages
		room.show()
		
		render_page(page)
	},
	cleanUp(type) {
		//$messageList.replaceChildren()
		room && room.hide() //so it's fucking possible for cleanup to get called TWICE if there's an error, sometimes.
		room = null
		flag('canEdit', false)
	},
	init() {
		let send_message = ()=>{
			let room = ChatRoom.currentRoom
			if (!room)
				return;
			
			let data = read_input(editing_comment, !!editing_comment)
			if (editing_comment) { // editing comment
				let last_edit = editing_comment
				cancel_edit()
				$chatTextarea.focus()
				
				if (data.content) { // input not blank
					Req.editMessage(last_edit.id, last_edit.parentId, data.content, data.meta, (e)=>{
						if (e) {
							alert("Editing comment failed")
						}
					})
				} else { // input is blank
					let resp = confirm("Are you sure you want to delete this message?\n"+last_edit.content)
					if (resp) {
						Req.deleteMessage(last_edit.id, (e, resp)=>{
							if (e) {
								alert("Deleting comment failed")
							}
						})
					}
				}
			} else { // posting new comment
				if (data.content) { // input is not blank
					let old = data
					Req.sendMessage(room.id, data.content, data.meta, (e, resp)=>{
						if (e) {
							//error sending message
							write_input(old)
						} else {
						}
					})
					// going to try this hack to see if that fixes safari
					window.setTimeout(()=>{
						$chatTextarea.value = "" //hack?
						textarea_resize()
					}, 0)
				}
			}
		}
		// up arrow = edit last comment
		// todo: keep track of the previous message more reliably
		// either store it when displayed and only pull info from the server if necessary, or idk
		$chatTextarea.onkeydown = (e)=>{
			if (e.keyCode==38 && $chatTextarea.value=="") { // up arrow
				let room = ChatRoom.currentRoom
				let msg = room && room.my_last_message()
				if (msg && msg.x_data)
					edit_comment(msg.x_data)
			}
		}
		$chatTextarea.onkeypress = (e)=>{
			if (!e.shiftKey && e.keyCode == 13) { // enter
				e.preventDefault()
				send_message()
			}
		}
		// TODO: make sure this is ready when the long poller starts!
		// right now it PROBABLY will be but that isn't certain
		// the long poller could technically start before onload
		ChatRoom.global = new ChatRoom(-1)
		
		// TODO: this is a really common pattern for buttons
		// (disable, then reenable when an action finishes)
		// would be nice to have a system for that
		$hideGlobalStatusButton.onclick = (e)=>{
			if ($hideGlobalStatusButton.disabled)
				return
			$hideGlobalStatusButton.disabled = true
			ChatRoom.global.toggleHiding(()=>{
				$hideGlobalStatusButton.disabled = false
			})
		}
		
		$chatCancelEdit.onclick = ()=>{
			cancel_edit()
		}
		// todo: global escape handler?
		document.addEventListener('keydown', (e)=>{
			if (e.keyCode == 27) {
				cancel_edit()
			}
		})
		
		let textarea_resize = ()=>{
			$chatTextarea.style.height = ''
			let oldBottom
			let room = ChatRoom.currentRoom
			if (room)
				oldBottom = room.scroller.scrollBottom
			let height = $chatTextarea.scrollHeight
			$chatTextarea.parentNode.style.height = $chatTextarea.style.height = height+1+"px"
			if (room) {
				room.scroller.ignore_scroll = true
				room.scroller.scrollBottom = oldBottom
			}
		}
		textarea_resize()
		$chatTextarea.addEventListener('input', textarea_resize)
		track_resize_2.add($chatTextarea, textarea_resize)
	}
})

function read_input(old, edit) {
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

function write_input(data) {
	$chatTextarea.value = data.content || ""
	$chatMarkupSelect.checked = data.meta.m == Settings.values.chat_markup
}

let pre_edit = null
let editing_comment = null

// todo: move this onto the ChatRoom object??
$.editComment = edit_comment //HACK
function edit_comment(comment) {
	if (editing_comment)
		cancel_edit()
	if (!comment)
		return
	pre_edit = read_input()
	editing_comment = comment
	write_input(comment)
	View.flag('chatEditing', true)
	// todo: maybe also save/restore cursor etc.
	window.setTimeout(x=>{
		$chatTextarea.setSelectionRange(99999,99999)
		$chatTextarea.focus()
	},0)
}

function cancel_edit() {
	if (editing_comment) {
		editing_comment = null
		View.flag('chatEditing', false)
		write_input(pre_edit)
	}
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
