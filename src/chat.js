'use strict'
//todo: read my old notes (in chat) about how to handle edited messages
// ex: when a message is moved between rooms,

class MessageList {
	constructor(element, pid, edit) {
		this.elem = element
		this.elem.classList.add('message-list') // todo: just create a new elem <message-list> ?
		this.pid = pid
		this.parts = Object.create(null)
		this.total_parts = 0
		this.edit_callback = edit
	}
	get_messages_near(last, newer, amount, callback) {
		let order = newer ? 'id' : 'id_desc'
		let query = `contentId = @pid AND id ${newer?">":"<"} @last`
		Lp.chain({
			values: {last: last, pid: this.pid},
			requests: [
				{type:'message', fields:'*', query, order, limit:amount},
				{type:'user', fields:'*', query:"id in @message.createUserId"},
			],
		}, callback)
	}
	// todo
	// need to prevent this from loading messages multiple times at once
	// and inserting out of order...x
	draw_messages_near(newer, amount, callback) {
		let block = this.elem[newer?'lastChild':'firstChild']
		if (!block)
			return null
		let content = block.querySelector('message-contents')
		let part = content[newer?'lastChild':'firstChild']
		if (!part)
			return null
		let id = part.x_data.id
		return this.get_messages_near(id, newer, amount, resp=>{
			let first = true
			for (let c of resp.message) {
				let part = this.display_message(c, !newer)
				if (part && first) {
					part.className += " boundary-"+(newer?"top":"bottom")
					first = false
				}
			}
			callback(resp.message.length != 0)
		})
	}
	single_message(comment) {
		let [block, contents] = Draw.message_block(comment)
		block.dataset.merge = this.merge_hash(comment)
		let part = Draw.message_part(comment)
		this.parts[comment.id] = part
		this.total_parts = 1
		contents.append(part)
		this.elem.append(block)
	}
	display_message(message, backwards) {
		if (message.deleted) {
			this.remove_message(message.id)
			return null
		}
		let old = this.parts[message.id]
		if (old) {
			let part = Draw.message_part(message)
			old.replaceWith(part)
			this.parts[message.id] = part
			return part
		}
		let contents
		// check whether message can be merged
		let block = this.elem[backwards?'firstChild':'lastChild']
		if (block) {
			// if the prev block has message-contents
			let oldcontents = block.querySelector('message-contents')
			if (oldcontents) {
				// and the merge-hashes match
				let oldhash = block.dataset.merge
				let newhash = this.merge_hash(message)
				if (oldhash == newhash) {
					// aand the time isn't > 5 minutes
					let last = oldcontents[backwards?'firstChild':'lastChild']
					if (last) {
						if (!last.x_data) {
							alert("wrong element in message-contents:", last.nodeName)
						} else {
							let oldtime = last.x_data.createDate2
							if (Math.abs(message.createDate2-oldtime) <= 1000*60*5)
								contents = oldcontents
						}
					}
				}
			}
		}
		// otherwise create a new message-block
		if (!contents) {
			;[block, contents] = Draw.message_block(message) // TODO: the time will be wrong, if we are displaying backwards!!
			block.dataset.merge = this.merge_hash(message)
			this.elem[backwards?'prepend':'append'](block)
		}
		// draw+insert the new message-part
		let part = Draw.message_part(message)
		contents[backwards?'prepend':'append'](part)
		this.parts[message.id] = part
		this.total_parts++
		return part
	}
	remove_message(id) {
		let part = this.parts[id]
		if (!part)
			return false
		
		let contents = part.parentNode // <message-contents>
		part.remove()
		delete this.parts[id]
		this.total_parts--
		
		if (!contents.hasChildNodes())
			contents.parentNode.remove() // remove <message-block> if empty
		
		return true
	}
	over_limit() {
		return this.total_parts > this.max_parts /*&& !this.disable_limit*/
	}
	limit_messages() {
		for (let id in this.parts) {
			if (this.total_parts <= this.max_parts)
				break
			if (!this.remove_message(id))
				break //fail
		}
	}
	merge_hash(message) {
		let user = message.Author
		return `${message.contentId},${message.createUserId},${user.avatar},${user.bigAvatar||""},${user.username} ${user.nickname || ""}`
	}
	
	static show_controls(elem) {
		if (elem == this.controls_message)
			return
		if (elem) // this must be the element where .x_data is set
			elem.before(this.controls)
		else
			this.controls.remove()
		this.controls_message = elem
	}
	static onload() {
		this.controls = Draw.message_controls(()=>{
			alert(JSON.stringify(this.controls_message.x_data, null, 1)) // <small heart>
		}, ()=>{
			if (this.controls_message) {
				let ev = new Event('edit_message', {bubbles: true, cancellable: true})
				this.controls_message.dispatchEvent(ev)
			}
		}).elem
		
		let listen = (ev, fn)=>{
			document.body.addEventListener(ev, fn, {passive: true})
		}
		
		/*listen('focusin', e=>{
			let elem = e.target.closest("message-part, .message-list")
			if (!elem)
				this.show_controls(null)
			else if (elem.tagName=='MESSAGE-PART')
				this.show_controls(elem)
		})
		listen('focusout', e=>{
			//if (e.target.closest(".message-list"))
			// TODO: fix flickering when button is clicked
			this.show_controls(null)
		})*/
		
		// todo: check out relatedTarget?
		// TODO: this causes problems on mobile when clicking images/links etc.
		// probably need to like
		// replace this handler's event with one that doesn't capture touches
		// and then add a separate touchstart etc. handler which doesnt accept click and etc. maybe we need to cancel click (or check if it's been handled?) somewhere somehow beforehand
		listen('mouseover', e=>{
			let elem = e.target.closest("message-part, message-controls, .message-list")
			if (!elem || elem.classList.contains('message-list'))
				this.show_controls(null)
			else if (elem.tagName=='MESSAGE-PART')
				this.show_controls(elem)
			// otherwise, the element is <message-controls> so we do nothing
		})
		listen('mouseleave', e=>{
			this.show_controls(null)
		})
	}
}
MessageList.controls = null
MessageList.controls_message = null
MessageList.prototype.max_parts = 500

class ChatRoom {
	constructor(id, page) {
		if (this.constructor.rooms[id])
			throw new Error("tried to create duplicate chatroom")
		this.constructor.rooms[id] = this
		
		this.id = id
		this.set_status("active")
		
		if (id == 0) {
			do_when_ready(()=>{
				this.userlist_elem = $sidebarUserList
				this.update_userlist()
			})
			return
		}
		
		this.edit_callback = null
		
		let e = this.constructor.HTML.block()
		this.chat_pane = e
		// page element
		let page1 = e.firstChild
		this.page_outer = page1
		this.page_contents = page1.lastChild
		// resize handle
		let resize = e.querySelector('resize-handle')
		let height = null
		//height = 0
		View.attach_resize(page1, resize, false, 1, 'setting--divider-pos-'+page.id, null, height)
		// userlist
		this.userlist_elem = e.querySelector('.userlist')
		// scroller
		let outer = e.lastChild
		let inner = outer.firstChild
		this.messages_outer = outer
		this.scroll_inner = inner
		this.list = new MessageList(inner.lastChild.previousSibling, this.id)
		this.list.elem.addEventListener('edit_message', e=>{
			// todo: weakmap instead of this x_data field?
			if (this.edit_callback)
				this.edit_callback(e.target.x_data)
		})
		// 
		let extra = inner.firstChild
		this.extra = extra
		this.limit_checkbox = extra.querySelector('input')
		this.load_more_button = extra.querySelector('button')
		//		<div class='pageInfoPane rem2-3 bar'></div>
		
		// chat
		this.message_parts = {}
		this.total_messages = 0
		
		this.load_more_button.onclick = e=>{
			let btn = e.currentTarget
			if (btn.disabled) return
			btn.disabled = true
			// todo: preserve scroll position
			this.list.draw_messages_near(false, 50, ()=>{
				btn.disabled = false
			})
		}
		
		if (page.values.pinned) { //todo: check if actually we have any real pinned messages
			let pinned_separator = document.createElement('div')
			pinned_separator.className = "messageGap"
			this.extra.prepend(pinned_separator)
			
			this.pinnedList = document.createElement('div')
			this.extra.prepend(this.pinnedList)
		}
		
		$chatPaneBox.append(this.chat_pane)
		
		///////////
		this.visible = false
		this.pinned = false
		this.scroller = new Scroller(this.messages_outer, this.scroll_inner)
		
		this.update_page(page)
		this.update_userlist()
		
		Object.seal(this)
	}
	set_status(s) {
		this.status = s
		Lp.set_status(this.id, s)
	}
	update_avatar(id) {
		this.update_userlist()
	}
	update_userlist() {
		let statusmap = ChatRoom.statuses[this.id] || {}
		this.userlist_elem.fill()
		Object.for(statusmap, (status, id)=>{
			let user = ChatRoom.status_users[~id]
			if (!user) {
				print("unknown user ("+id+") in userlist")
				return
			}
			this.userlist_elem.append(Draw.userlist_avatar(user, status))
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
		Markup.convert_lang(page.text, page.values.markupLang, this.page_contents, {intersection_observer: Draw.observer})
	}
	// 8:10;35
	show() {
		let old = ChatRoom.currentRoom
		if (old && old!=this)
			old.hide()
		this.chat_pane.classList.add('shown')
		this.visible = true
		ChatRoom.currentRoom = this
	}
	hide() {
		if (this.pinned) {
			this.chat_pane.classList.remove('shown')
			if (ChatRoom.currentRoom == this)
				ChatRoom.currentRoom = null
			this.visible = false
		} else
			this.destroy()
	}
	destroy() {
		if (ChatRoom.currentRoom == this)
			ChatRoom.currentRoom = null
		ChatRoom.removeRoom(this)
		
		this.chat_pane.remove()
		this.chat_pane.fill()
		this.userlist_elem = null
		
		this.scroller.destroy()
		this.scroller = null
		this.visible = false
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
	static removeRoom(room) {
		if (this.currentRoom == room)
			this.currentRoom = null
		if (this.rooms[room.id] == room)
			delete this.rooms[room.id]
		if (room.status!=undefined)
			Lp.set_status(room.id, null)
		//ChatRoom.setViewing(Object.keys(ChatRoom.rooms))
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
	static obtain_room(id, page, message) {
		let room = this.rooms[id]
		if (room)
			room.update_page(page)
		else {
			room = new this(id, page)
			room.display_initial_messages(message/*, pinned*/) //todo: when page is edited, update pinned messages
		}
		return room
	}
}
ChatRoom.rooms = {}
ChatRoom.global = null
ChatRoom.currentRoom = null
// we don't store these per-room
// since we want to track statuses for rooms that aren't loaded
ChatRoom.statuses = {}
ChatRoom.status_users = {}
ChatRoom.HTML = {
	block: 𐀶`
<chat-pane class='resize-box COL'>
	<scroll-outer class='sized page-container'>
		<div class='pageContents'></div>
	</scroll-outer>
	<resize-handle></resize-handle>
	<div class='bar rem2-3 userlist'>...</div>
	<scroll-outer class='FILL'>
		<scroll-inner>
			<div>
				<button-container><button>load older messages</button></button-container>
				<label><input type=checkbox>disable limit</label>
			</div>
			<message-list></message-list>
			<div class='chat-bottom' tabindex=0></div>
		</scroll-inner>
	</scroll-outer>
</chat-pane>
`,
}
Object.seal(ChatRoom)
Object.seal(MessageList)

// todo: when starting to render any page
//- run generatestatus and generatelisteners
//- if changed, refresh long poller with new data
//- when rendering chat, we need to retrieve the listeners list from Req

