let ChatRoom = function(){"use strict"; return new_class(class ChatRoom {
	constructor(id, page) {
		let old = ChatRoom.rooms[id]
		if (old)
			return old
		
		this.id = id
		this.status = "active"
		this.userlist = []
		
		if (id == -1) {
			this.userlist_elem = $sidebarUserList
			return
		}
		
		Draw.chat_pane(this, page)
		
		// chat
		this.message_parts = {}
		this.max_messages = 500
		this.total_messages = 0
		
		this.load_more_button.onclick = (e)=>{
			if (e.target.disabled) return
			e.target.disabled = true
			// todo: preserve scroll position
			Draw.load_messages_near(this.id, this.messageList, false, 50, ()=>{
				e.target.disabled = false
			})
		}
		
		if (page.values.pinned) { //todo: check if actually we have any real pinned messages
			let pinnedSeparator = document.createElement('div')
			pinnedSeparator.className = "messageGap"
			this.extra.prepend(pinnedSeparator)
			
			this.pinnedList = document.createElement('div')
			this.extra.prepend(this.pinnedList)
		}
		
		$chatPaneBox.append(this.chat_pane)
		
		///////////
		this.visible = false
		this.pinned = false
		this.scroller = new Scroller(this.messages_outer, this.scroll_inner)
		
		/////////////////////////////
		// set up message controls //
		/////////////////////////////
		this.controls_message = null
		let controls = Draw.message_controls(()=>{
			alert(JSON.stringify(this.controls_message.x_data))
		},()=>{
			if (this.controls_message)
				window.editComment(this.controls_message.x_data)
		})
		this.controls = controls.elem
		
		this.messageList.addEventListener('focusin', (e)=>{
			let elem = e.target.closest("message-part, scroll-inner")
			if (!elem)
				this.show_controls(null)
			else if (elem.tagName=='MESSAGE-PART')
				this.show_controls(elem)
		})
		this.messageList.addEventListener('focusout', (e)=>{
			this.show_controls(null)
		})
		
		this.messageList.onmouseover = (e)=>{
			let elem = e.target.closest("message-part, message-controls, scroll-inner")
			if (!elem || elem.tagName=='SCROLL-INNER')
				this.show_controls(null)
			else if (elem.tagName=='MESSAGE-PART')
				this.show_controls(elem)
			// otherwise, the element is <message-controls> so we do nothing
		}
		this.messageList.onmouseleave = (e)=>{
			this.show_controls(null)
		}
		this.update_page(page)
	//	let l = Lp.processed_listeners[id] //should this be done with id -1? // what?
	//	l && this.update_userlist(l)
		ChatRoom.addRoom(this)
		
		Object.seal(this)
	}
	
	limit_messages() {
		if (this.total_messages <= this.max_messages)
			return
		if (this.limit_checkbox.checked)
			return
		this.scroller.print_top(()=>{
			for (let id in this.message_parts) {
				if (this.total_messages <= this.max_messages)
					break
				if (!this.remove_message(id))
					break //fail
			}
		})
	}
	remove_message(id) {
		let message = this.message_parts[id]
		if (!message)
			return false
		
		let contents = message.parentNode // <message-contents>
		message.remove()
		delete this.message_parts[id]
		this.total_messages--
		
		if (!contents.firstChild)
			contents.parentNode.remove() // remove <message-block> if empty
		
		return true
	}
	update_avatar(user) {
		let item = this.userlist.find(item => item.user.id == user.id)
		if (item) {
			item.user = user
			this.update_userlist(this.userlist)
		}
	}
	update_userlist(list) {
		this.userlist_elem.fill(Object.values(list).map(item => Draw.userlist_avatar(item)))
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
		Markup.convert_lang(page.text, page.values.markupLang, this.page_contents)
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
		this.message_parts = {}
	}
	insert_merge(comment, backwards) {
		let part = Draw.insert_comment_merge(this.messageList, comment, backwards)
		this.total_messages++
		this.message_parts[comment.id] = part
	}
	my_last_message() {
		return Object.values(this.message_parts).findLast((msg)=>{
			return msg && msg.x_data.createUserId == Req.uid
		})
	}
	// display a list of messages
	// DON'T call this unless you know what you're doing
	
	// comments: [Comment]
	// animate: Boolean - whether to play the scrolling animation
	display_messages(comments, animate=true) {
		this.scroller.print(()=>{
			for (let comment of comments) {
				if (comment.deleted) {
					this.remove_message(comment.id)
				} else {
					let old = this.message_parts[comment.id]
					if (old) { // edited
						let part = Draw.message_part(comment)
						this.message_parts[comment.id] = part
						old.replaceWith(part)
					} else { // new comment
						this.insert_merge(comment, false)
					}
				}
			}
		}, animate)
		this.limit_messages()
	}
	
	show_controls(elem) {
		if (elem) {
			// why does this fail sometimes?
			if (!elem.parentNode) {
				console.error("oops, elem was removed?")
			} else {
				elem.parentNode.insertBefore(this.controls, elem)
				this.controls_message = elem // this must be the element where .x_data is set
			}
		} else {
			this.controls.remove()
			this.controls_message = null
		}
	}
	
}, { // STATIC METHODS
	/* static */
	rooms: {},
	global: null,
	currentRoom: null,
	
	/* static */ 
	listening_rooms() {
		let list = [-1]
		for (let id in this.rooms)
			list.push(id)
		return list
	},
	
	/* static */
	generateStatus() {
		let status = {}
		for (let id in this.rooms)
			status[id] = this.rooms[id].status
		status[-1] = this.global.status
		return status
	},
	
	/* static */
	update_avatar(user) {
		Object.for(this.rooms, room => room.update_avatar(user))
		this.global && this.global.update_avatar(user)
	},
	
	/* static */
	addRoom(room) {
		this.rooms[room.id] = room
		//ChatRoom.setViewing(Object.keys(ChatRoom.rooms))
	},
	
	/* static */
	removeRoom(room) {
		if (this.currentRoom == room)
			this.currentRoom = null
		if (this.rooms[room.id] == room)
			delete this.rooms[room.id]
		//ChatRoom.setViewing(Object.keys(ChatRoom.rooms))
	},
	
	/* static */
	update_userlists(a) {
		// why don't we just use .rooms[-1] instead of .global?
		a[-1] && this.global.update_userlist(a[-1])
		for (let id in a) {
			let room = this.rooms[id]
			room && room.update_userlist(a[id])
		}
	},
	
	// display a list of messages from multiple rooms
	/* static */
	display_messages(comments) {
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
	},
	
	/* static */
	title_notification(comment) {
		View.title_notification(comment.text, Draw.avatar_url(comment.Author, "size=120&crop=true"))
		// todo: also call if the current comment being shown in the title is edited
	},
	
	/* static */
	// shouldnt be here, but nowhere else to put it..
	load_messages_near(page, last, newer, amount, callback) {
		let order = newer ? 'id' : 'id_desc'
		let query = `contentId = @pid AND id ${newer?">":"<"} @last`
		Lp.chain({
			values: {last:last, pid:page},
			requests: [
				{type:'message', fields:'*', query, order, limit: amount},
				{type:'user', fields:'*', query:"id in @message.createUserId"},
			]
		}, callback)
	}
	
})}()

// todo: when starting to render any page
//- run generatestatus and generatelisteners
//- if changed, refresh long poller with new data
//- when rendering chat, we need to retrieve the listeners list from Req

