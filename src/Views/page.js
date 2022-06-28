'use strict'

function register_activity(e) {
	// 1: if currently inactive, switch to active
	// 2: record time
}
// 3: on a ~1 minute interval timer, check if last activity time was > 3 minutes or whatever, and go inactive

//;['wheel','keydown','mousedown','mousemove','touchstart'].forEach(event => document.addEventListener(event, registerActivity))
//window.addEventListener('focus', registerActivity)

//todo: views should be classes that extend a base class
// then, most of the query is static and etc.

class PageView extends BaseView {
	Init() {
		this.pre_edit = null
		this.editing_comment = null
		this.room = null
		this.id = null
		this.status = undefined
		this.edit_callback = null
		this.list = null
		
		this.$textarea.enterKeyHint = Settings.chat_enter!='newline' ? "send" : "enter" // uh this won't update though... need a settings change watcher
		
		this.$textarea.onkeydown = e=>{
			if (e.isComposing)
				return
			// enter - send
			if (Settings.values.chat_enter!='newline' && e.keyCode==13 && !e.shiftKey) {
				e.preventDefault()
				this.send_message()
			}
			// up arrow - edit previous message
			if (e.keyCode==38 && this.$textarea.value=="") {
				let msg = this.my_last_message()
				if (msg && msg.x_data) {
					e.preventDefault()
					this.edit_comment(msg.x_data)
				}
			}
		}
		this.$send.onclick = e=>{
			this.send_message()
		}
		this.$cancel.onclick = e=>{
			this.cancel_edit()
		}
		// TODO: global escape handler?
		/*document.addEventListener('keydown', e=>{
			if (e.keyCode==27)
				this.cancel_edit()
		})*/
		let r = this.textarea_resize.bind(this)
		this.$textarea.addEventListener('input', r, {passive: true})
		PageView.track_resize_2.add(this.$textarea, ()=>{
			window.setTimeout(r)
		})
	}
	Visible() {
		this.textarea_resize()
	}
	Start({id, query}) {
		let field
		if ('number'==typeof id) {
			field = 'id'
		} else {
			field = 'hash'
		}
		return {
			chain: {
				values: {
					key: id,
				},
				requests: [
					{type: 'content', fields: "*", query: `${field} = @key`},
					{type: 'message', fields: "*", query: "contentId in @content.id AND !notdeleted()", order: 'id_desc', limit: 30},
					//				{name: 'Mpinned', type: 'message', fields: "*", query: "id in @content.values.pinned"},
					{type: 'user', fields: "*", query: "id IN @content.createUserId OR id IN @message.createUserId OR id IN @message.editUserId"},
				],
			},
			ext: {},
			check(resp) {
				return resp.content[0]
			},
		}
	}
	Render({message, content:[page]}, ext) {
		this.id = page.id
		
		message.reverse()
//		let pinned = objects.Mpinned
		
		this.set_status("active")
		
		PageView.rooms[this.id] = this
		
		// resize handle
		let height = null
		//height = 0
		View.attach_resize(this.$page_container, this.$resize_handle, false, 1, 'setting--divider-pos-'+this.id, null, height)
		// scroller
		this.list = new MessageList(this.$message_list, this.id)
		this.list.elem.addEventListener('edit_message', e=>{
			// todo: weakmap instead of this x_data field?
			if (this.edit_callback)
				this.edit_callback(e.target.x_data)
		})
		// chat
		this.message_parts = {}
		this.total_messages = 0
		
		this.$load_older.onclick = e=>{
			let btn = e.target
			if (btn.disabled) return
			btn.disabled = true
			// todo: preserve scroll position
			this.list.draw_messages_near(false, 50, ()=>{
				btn.disabled = false
			})
		}
		
		///////////
		this.visible = false
		this.pinned = false
		this.scroller = new Scroller(this.$outer, this.$inner)
		
		if (page.values.pinned) { //todo: check if actually we have any real pinned messages
			let pinned_separator = document.createElement('div')
			pinned_separator.className = "messageGap"
			this.$extra.prepend(pinned_separator)

			const pinnedListDiv = document.createElement('div')
			this.pinnedList = new MessageList(pinnedListDiv, this.id)
			this.$extra.prepend(pinnedListDiv)			
			
			Lp.chain({
				values: {pinned: page.values.pinned},
				requests: [
					{type:'message', fields: '*', query: 'id IN @pinned'},
					{type:'user', fields: '*', query: 'id IN @message.createUserId'},
				]
			}, (resp)=>{
				const {message: pinned} = resp;
				if (pinned instanceof Array && this.pinnedList)
					this.scroller.print_top(()=>{
						for (const m of pinned)
							this.pinnedList.display_message(m, false)
					})
			})
		}
		
		this.update_page(page)
		this.update_userlist()
		
		this.display_initial_messages(message/*, pinned*/) //todo: when page is edited, update pinned messages
		
		PageView.currentRoom = this
		
		View.set_entity_title(page)
		//View.set_entity_path(page.parent)
		View.flag('canEdit', /u/i.test(page.permissions[Req.uid]))
		$pageCommentsLink.href = "#comments/"+page.id+"?r" // todo: location
		$pageEditLink.href = "#editpage/"+page.id
		if (page.createUserId==Req.uid || /c/i.test(page.permissions[Req.uid] || page.permissions[0])) {
			this.$textarea.disabled = false
			this.$textarea.focus()
		} else
			this.$textarea.disabled = true
		this.edit_callback = msg=>this.edit_comment(msg)
	}
	set_status(s) {
		this.status = s
		Lp.set_status(this.id, s)
	}
	update_avatar(id) {
		this.update_userlist()
	}
	update_userlist() {
		let statusmap = PageView.statuses[this.id] || {}
		this.$userlist.fill()
		Object.for(statusmap, (status, id)=>{
			let user = PageView.status_users[~id]
			if (!user) {
				print("unknown user ("+id+") in userlist")
				return
			}
			this.$userlist.append(Draw.userlist_avatar(user, status))
		})
	}
	display_initial_messages(comments, pinned) {
		this.display_messages(comments, false)
		// show pinned comments
		if (pinned instanceof Array && this.pinnedList)
			this.scroller.print_top(()=>{
				this.pinnedList.fill(pinned.map(m=>Draw.single_message(m)))
			})
	}
	update_page(page) {
		this.page = page
		Markup.convert_lang(page.text, page.values.markupLang, this.$page_contents, {intersection_observer: View.observer})
	}
	// 8:10;35
	Cleanup(type) {
		if (this.status!=undefined)
			Lp.set_status(this.id, null)
		PageView.currentRoom = null
		delete PageView.rooms[this.id]
		this.scroller.destroy()
		View.flag('canEdit', false)
	}
	my_last_message() {
		return Object.values(this.list.parts).findLast((msg)=>{
			return msg && msg.x_data.createUserId == Req.uid
		})
	}
	// display a list of messages
	// DON'T call this unless you know what you're doing
	// comments: [Comment]
	// animate: Boolean - whether to play the scrolling animation
	display_messages(comments, animate=true) {
		this.scroller.print(()=>{
			for (let comment of comments)
				this.list.display_message(comment, false)
		}, animate)
		if (this.list.over_limit() && !this.limit_checkbox.checked) {
			this.scroller.print_top(()=>{
				this.list.limit_messages()
			})
		}
	}
	/////
	static listening_rooms() {
		let list = [0]
		for (let id in this.rooms)
			list.push(id)
		return list
	}
	static update_avatar(user) {
		let s = this.status_users[~user.id]
		if (!s) return
		this.status_users[~user.id] = user
		Object.for(this.rooms, (room, id)=>{
			if (this.statuses[id][user.id])
				room.update_avatar(user.id)
		})
	}
	static update_userlists(statuses, {user}) {
		Object.assign(this.statuses, statuses)
		Object.assign(this.status_users, user)
		for (let id in this.rooms) {
			this.rooms[id].update_userlist()
		}
	}
	// display a list of messages from multiple rooms
	static display_messages(comments) {
		// for each room, display all of the new comments for that room
		for (let room of Object.values(this.rooms)) {
			let c = comments.filter(c => c.contentId==room.id)
			if (c.length)
				room.display_messages(c, room==this.currentRoom)
		}
		// display comment in title
		// does this belong here, or in the room displaycomments message?
		// I feel like here is better so each room doesn't need to be checking if it's current.. idk
		if (this.currentRoom) {
			let last = comments.findLast((c)=>
				c.contentId==this.currentRoom.id && Entity.is_new_comment(c))
			if (last)
				this.title_notification(last)
		}
	}
	static title_notification(comment) {
		View.title_notification(comment.text, Draw.avatar_url(comment.Author, "size=120&crop=true"))
		// todo: also call if the current comment being shown in the title is edited
	}
	// get/create room
	static obtain_room(id, page, message, pv) {
		let room = this.rooms[id]
		if (room)
			room.update_page(page)
		else {
			room = new this(id, page, pv)
		}
		return room
	}
	textarea_resize() {
		this.$textarea.style.height = ""
		let height = this.$textarea.scrollHeight
		this.$textarea.parentNode.style.height = this.$textarea.style.height = height+1+"px"
	}
	
	send_message() {
		let data = this.read_input(this.editing_comment)
		
		if (this.editing_comment) { // editing comment
			let last_edit = this.editing_comment
			this.cancel_edit()
			this.$textarea.focus()
			
			if (data.text) { // input not blank
				last_edit.text = data.text
				last_edit.values = data.values //mmn
				Req.send_message(last_edit).do = (resp, err)=>{
					if (err)
						alert("Editing comment failed")
				}
			} else { // input is blank
				let resp = confirm("Are you sure you want to delete this message?\n"+last_edit.text)
				if (!resp)
					return
				Req.delete('message', last_edit.id).do = (resp, err)=>{
					if (err)
						alert("Deleting comment failed")
				}
			}
		} else { // posting new comment
			if (data.text) { // input is not blank
				let old = data
				Req.send_message({
					contentId: this.id,
					text: data.text,
					values: data.values,
				}).do = (resp, err)=>{
					//if (err) //error sending message
						//this.write_input(old)
				}
				this.$textarea.select()
				document.execCommand('delete')
				//$chatTextarea.value = ""
				this.textarea_resize()
			}
		}
	}
	
	read_input(old) {
		let values = old ? old.values : {}
		
		if (old) {
			if (this.$markup.value)
				values.m = this.$markup.value
			else
				delete values.m
		} else {
			if (Req.me)
				values.a = Req.me.avatar
			if (Settings.values.nickname)
				values.n = Entity.filter_nickname(Settings.values.nickname)
			if (Settings.values.big_avatar=='on' && Settings.values.big_avatar_id)
				values.big = Settings.values.big_avatar_id
			values.m = Settings.values.chat_markup
		}
		
		return {
			values: values,
			text: this.$textarea.value,
		}
	}
	
	write_input(data) {
		this.$textarea.select()
		if (data.text)
			document.execCommand('insertText', false, data.text)
		else
			document.execCommand('delete')
		this.textarea_resize()
		let markup = data.values.m
		if ('string'!=typeof markup)
			markup = ""
		this.$markup.value = markup
	}

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
			this.$textarea.setSelectionRange(99999, 99999) // move cursor to end
			this.$textarea.focus()
		})
	}
	cancel_edit() {
		if (this.editing_comment) {
			this.editing_comment = null
			View.flag('chatEditing', false)
			this.write_input(this.pre_edit)
		}
	}	
}
PageView.track_resize_2 = new ResizeTracker('width')
PageView.template = HTML`
<div class='COL'>
	<div class='FILL SLIDES' $=panes>
		<chat-pane class='resize-box shown COL'>
			<scroll-outer class='sized page-container' $=page_container>
				<div class='pageContents' $=page_contents></div>
			</scroll-outer>
			<resize-handle $=resize_handle></resize-handle>
			<div class='bar rem2-3 userlist' $=userlist>...</div>
			<scroll-outer class='FILL' $=outer>
				<scroll-inner $=inner>
					<div $=extra>
						<button-container><button $=load_older>load older messages</button></button-container>
						<label><input type=checkbox $=limit_checkbox>disable limit</label>
					</div>
					<message-list $=message_list></message-list>
					<div class='chat-bottom' tabindex=0></div>
				</scroll-inner>
			</scroll-outer>
		</chat-pane>
	</div>
	<div class='inputPane loggedIn ROW'>
		<div class='showWhenEdit COL'>
			<input $=markup placeholder="markup" style="width:50px;">
			<button class='FILL' $=cancel>Cancel Edit</button>
		</div>
		<textarea-container class='FILL'>
			<div $=textarea_width></div>
			<textarea class='chatTextarea' $=textarea accesskey="z"></textarea>
		</textarea-container>
		<div class='COL'>
			(temp)
			<button class='FILL' $=send>Send</button>
		</div>
	</div>
</div>
`
PageView.statuses = {}
PageView.status_users = {}
PageView.rooms = {}
PageView.currentRoom = null

PageView.rooms[0] = PageView.global = Object.seal({
	id: 0,
	$userlist: null,
	status: undefined,
	update_userlist() {
		let statusmap = PageView.statuses[this.id] || {}
		this.$userlist.fill()
		Object.for(statusmap, (status, id)=>{
			let user = PageView.status_users[~id]
			if (!user) {
				print("unknown user ("+id+") in userlist")
				return
			}
			this.$userlist.append(Draw.userlist_avatar(user, status))
		})
	},
	set_status(s) {
		this.status = s
		Lp.set_status(this.id, s)
	},
	update_avatar(id) {
		this.update_userlist()
	},
})
do_when_ready(()=>{
	PageView.global.$userlist = $sidebarUserList
})

PageView.register('page')
