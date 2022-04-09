function register_activity(e) {
	// 1: if currently inactive, switch to active
	// 2: record time
}
// 3: on a ~1 minute interval timer, check if last activity time was > 3 minutes or whatever, and go inactive

//;['wheel','keydown','mousedown','mousemove','touchstart'].forEach(event => document.addEventListener(event, registerActivity))
//window.addEventListener('focus', registerActivity)

//todo: views should be classes that extend a base class
// then, most of the query is static and etc.

View.add_view('page', {
	room: null, // do we need this?
	track_resize_2: new ResizeTracker('width'),
	
	render_page(page) {
		View.set_entity_title(page)
		//View.set_entity_path(page.parent)
		View.flag('canEdit', /u/i.test(page.permissions[Req.uid]))
		$chatTextarea.disabled = !(page.createUserId==Req.uid || /c/i.test(page.permissions[Req.uid] || page.permissions[0])) // don't use myperms here
		Nav.link("editpage/"+page.id, $pageEditLink)
		Nav.link("comments/"+page.id, $pageCommentsLink)
	},
	
	start(id, query) {
		let room = ChatRoom.rooms[id]
		if (room) {
			let z = room.pinned
			room.pinned = true
			return {quick: true, ext: {room, z}}
		}
		//todo: maybe we can request the user list early too?
		// the problem is, if we create the room early,
		// we might get messages from long polling before
		// loading the initial messages :(
		return {
			values: {
				pageid: id,
				filetype: 3,
			},
			requests: [
				{type: 'content', fields: "*", query: "id = @pageid"},
				{type: 'user', fields: "*", query: "id in @content.createUserId"},
			],
/*			chains: [
				['content', {ids: [id], IncludeAbout: ["votes","watches"]}],
				['comment', {parentIds: [id], limit: 30, reverse: true}],
				['comment.0values_pinned~Mpinned'],//: {parentIds: [id]}},
				['user.0createUserId.0editUserId.1createUserId.1editUserId.2createUserId.2editUserId'],
			],*/
			ext: {},
			check(resp) {
				return resp.content[0]
			},
		}
	},
	quick({room, z}) {
		let page = room.page
		//ChatRoom.setViewing([page.id])
		room.show()
		room.pinned = z
		this.render_page(page)
	},
	render(resp, ext) {
//		let comments = resp.comment
//		comments.reverse()
		let page = resp.content[0]
//		let pinned = resp.Mpinned
		
		// TODO: should we be calling this again every time?
//		Act.new_page_comments(page, comments)
//		Act.redraw()
		
		//ChatRoom.setViewing([page.id])
		this.room = new ChatRoom(page.id, page)
//		this.room.display_initial_messages(comments, pinned) //todo: when page is edited, update pinned messages
		this.room.show()
		
		this.render_page(page)
	},
	cleanup(type) {
		this.room && this.room.hide() //so it's fucking possible for cleanup to get called TWICE if there's an error, sometimes.
		room = null
		View.flag('canEdit', false)
	},
	init() {
		// todo: move this onto the ChatRoom object??
		window.editComment = this.edit_comment.bind(this) // HACK
		
		// up arrow = edit last comment
		// todo: keep track of the previous message more reliably
		// either store it when displayed and only pull info from the server if necessary, or idk
		$chatTextarea.onkeydown = (e)=>{
			if (e.keyCode==38 && $chatTextarea.value=="") { // up arrow
				let room = ChatRoom.currentRoom
				let msg = room && room.my_last_message()
				if (msg && msg.x_data)
					this.edit_comment(msg.x_data)
			}
		}
		$chatTextarea.onkeypress = (e)=>{
			if (!e.shiftKey && e.keyCode == 13) { // enter
				e.preventDefault()
				this.send_message()
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
			ChatRoom.global.toggle_hiding(()=>{
				$hideGlobalStatusButton.disabled = false
			})
		}
		
		$chatCancelEdit.onclick = ()=>{
			this.cancel_edit()
		}
		// todo: global escape handler?
		document.addEventListener('keydown', (e)=>{
			if (e.keyCode == 27)
				this.cancel_edit()
		})
		
		this.textarea_resize()
		let r = this.textarea_resize.bind(this)
		$chatTextarea.addEventListener('input', r)
		this.track_resize_2.add($chatTextarea, ()=>{
			window.setTimeout(r, 0)
		})
	},
	
	textarea_resize() {
		$chatTextarea.style.height = ''
		let height = $chatTextarea.scrollHeight
		$chatTextarea.parentNode.style.height = $chatTextarea.style.height = height+1+"px"
	},
	
	send_message() {
		let room = ChatRoom.currentRoom
		if (!room)
			return
		
		let data = this.read_input(this.editing_comment, !!this.editing_comment)
		if (this.editing_comment) { // editing comment
			let last_edit = this.editing_comment
			this.cancel_edit()
			$chatTextarea.focus()
			
			if (data.text) { // input not blank
				new (Req.send_message({id:last_edit.id, contentId:last_edit.contentId, text:data.text, values:data.values}))(resp=>{
					//
				},err=>{
					alert("Editing comment failed")
				})
			} else { // input is blank
				let resp = confirm("Are you sure you want to delete this message?\n"+last_edit.text)
				if (!resp) return
				new (Req.delete_message(last_edit.id))(resp=>{
					//
				},err=>{
					alert("Deleting comment failed")
				})
			}
		} else { // posting new comment
			if (data.text) { // input is not blank
				let old = data
				new (Req.send_message({contentId:room.id, text:data.text, values:data.values}))(resp=>{
					// 
				}, err=>{
					//error sending message
					this.write_input(old)
				})
				$chatTextarea.value = ""
				this.textarea_resize()
			}
		}
	},
	
	read_input(old, editing) {
		let values = old ? old.values : {}
		
		if ($chatMarkupSelect.checked)
			values.m = Settings.values.chat_markup
		else
			values.m = 'plaintext'
		if (!editing) {
			if (Req.me)
				values.a = Req.me.avatar
			if (Settings.values.nickname)
				values.n = Entity.filter_nickname(Settings.values.nickname)
			if (Settings.values.big_avatar=='on' && Settings.values.big_avatar_id)
				values.big = Settings.values.big_avatar_id
		}
		
		return {
			values: values,
			text: $chatTextarea.value,
		}
	},
	
	write_input(data) {
		$chatTextarea.value = data.text || ""
		$chatMarkupSelect.checked = data.values.m == Settings.values.chat_markup
		this.textarea_resize()
	},

	pre_edit: null,
	editing_comment: null,
	
	edit_comment(comment) {
		if (this.editing_comment)
			this.cancel_edit()
		if (!comment)
			return
		this.pre_edit = this.read_input()
		this.editing_comment = comment
		View.flag('chatEditing', true)
		this.write_input(comment) // do this after the flag, so the width is right
		// todo: maybe also save/restore cursor etc.
		window.setTimeout(x=>{
			$chatTextarea.setSelectionRange(99999, 99999) // move cursor to end
			$chatTextarea.focus()
		},0)
	},
	
	cancel_edit() {
		if (this.editing_comment) {
			this.editing_comment = null
			View.flag('chatEditing', false)
			this.write_input(this.pre_edit)
		}
	},
	
})

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
