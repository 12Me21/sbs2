class ChatRoom {
	constructor(id, page) {
		let old = this.constructor.rooms[id]
		if (old)
			return old
		
		this.id = id
		this.status = "active"
		this.userList = []
		
		if (id <= 0) {
			this.userListInner = $sidebarUserList
			return
		}
		
		let btn
		([this.chat_pane, this.pageContainer, this.pageElement, this.messagePane, this.messageList, this.userListInner, btn] = Draw.chat_pane(page))
		
		btn.onclick = ()=>{
			this.toggleHiding(()=>{
				ul[2].disabled = false
			})
			ul[2].disabled = true
		}
		
		// chat
		this.messageElements = {}
		this.lastTime = 0
		this.maxMessages = 500
		this.totalMessages = 0
		
		let label = document.createElement('label')
		let checkbox = label.createChild('input')
		checkbox.type = 'checkbox'
		this.limitCheckbox = checkbox
		let text = document.createTextNode('disable limit')
		label.append(text)
		
		this.messagePane.prepend(label)
		{
			let b = Draw.button()
			let btn = b[1]
			btn.textContent = "load older messages"
			btn.onclick = ()=>{
				if (btn.disabled)
					return
				btn.disabled = true
				this.loadOlder(50, ()=>{btn.disabled = false}) //todo: lock
			}
			this.messagePane.prepend(b[0])
		}
		
		if (page.values.pinned) { //todo: check if actually we have any real pinned messages
			let pinnedSeparator = document.createElement('div')
			pinnedSeparator.className = "messageGap"
			this.messagePane.prepend(pinnedSeparator)
			
			this.pinnedList = document.createElement('scroll-inner')
			this.messagePane.prepend(this.pinnedList)
		}
		
		this.messagePane.dataset.id = page.id
		$chatPaneBox.append(this.chat_pane)
		
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
				this.showControls(null)
			else if (elem.tagName=='MESSAGE-PART')
				this.showControls(elem)
		})
		this.messageList.addEventListener('focusout', (e)=>{
			this.showControls(null)
		})
		
		this.messageList.onmouseover = (e)=>{
			let elem = e.target.closest("message-part, message-controls, scroll-inner")
			if (!elem || elem.tagName=='SCROLL-INNER')
				this.showControls(null)
			else if (elem.tagName=='MESSAGE-PART')
				this.showControls(elem)
			// otherwise, the element is <message-controls> so we do nothing
		}
		this.messageList.onmouseleave = (e)=>{
			this.showControls(null)
		}
		///////////
		
		this.showChat = page.type == "@page.discussion"
		
		this.visible = false
		this.pinned = false
		this.scroller = new Scroller(this.messagePane, this.messageList)
		this.updatePage(page)
		let l = Lp.processed_listeners[id] //should this be done with id -1? // what?
		l && this.updateUserList(l)
		this.constructor.addRoom(this)
		
		if (this.page.type == 'resource')
			this.pageContainer.style.height = "1000px" //whatever
		else if (this.page.type == 'chat')
			this.pageContainer.style.height = "0"
		//this.pageContainer.style.maxHeight = '40vh'
		//View.attachResize(this.pageContainer, $chatResize, false, 1)
	}
	
	loadOlder(num, callback) {
		let firstId = Object.first_key(this.messageElements)
		Req.getCommentsBefore(this.id, +firstId, num, (comments)=>{
			comments && comments.forEach(c => this.displayOldMessage(c))
			callback()
		})
	}
	limitMessages() {
		if (this.limitCheckbox.checked)
			return
		for (let id in this.messageElements) {
			if (this.totalMessages <= this.maxMessages)
				break
			if (!this.removeMessage(id))
				break //fail
		}
	}
	removeMessage(id) {
		let message = this.messageElements[id]
		if (!message)
			return false
		
		let parent = message.parentNode
		
		//var x = this.scroller.scrollBottom
		message.remove()
		delete this.messageElements[id]
		this.totalMessages--
		
		if (!parent.firstChild)
			parent.parentNode.remove()
		//this.scroller.scrollBottom = x
		
		return true
	}
	toggleHiding(callback) {
		Req.toggleHiding(this.id, (hidden)=>{
			if (hidden)
				delete this.userList[Req.uid]
			else
				this.userList[Req.uid] = {user: Req.me, status: "unknown"}
			this.updateUserList(this.userList)
			callback && callback()
		})
	}
	updateUserAvatar(user) {
		let item = this.userList.find(item => item.user.id == user.id)
		if (item) {
			item.user = user
			this.updateUserList(this.userList)
		}
	}
	get scrollBottom() {
		let parent = this.messagePane
		return parent.scrollHeight-parent.clientHeight-parent.scrollTop
	}
	set scrollBottom(value) {
		// need to round here because it would be reversed otherwise
		value = Math.floor(value*window.devicePixelRatio)/window.devicePixelRatio
		let parent = this.messagePane
		parent.scrollTop = parent.scrollHeight-parent.clientHeight-value
	}
	updateUserList(list) {
		this.userListInner.replaceChildren(
			...Object.values(list).map(item => Draw.user_list_avatar(item))
		)
	}
	displayInitialMessages(comments, pinned) {
		comments.forEach(comment => this.displayMessage(comment, false))
		if (pinned instanceof Array && this.pinnedList) {
			this.pinnedList.append(...pinned.map((comment)=>{
				let b = Draw.message_block(comment)
				b[1].append(Draw.message_part(comment))
				return b[0]
			}))
		}
		// ugh why do we need this?
		window.setTimeout(()=>{this.scroller.scrollInstant()}, 0)
	}
	updatePage(page) {
		this.page = page
		this.pageElement.replaceChildren(
			Parse.parseLang(page.content, page.values.markupLang))
	}
	// 8:10;35
	show() {
		let old = this.constructor.currentRoom
		if (old && old!=this)
			old.hide()
		this.chat_pane.hidden = false
		this.visible = true
		this.constructor.currentRoom = this
	}
	hide() {
		if (this.pinned) {
			this.chat_pane.hidden = true
			if (this.constructor.currentRoom == this)
				this.constructor.currentRoom = null
			this.visible = false
		} else
			this.destroy()
	}
	destroy() {
		console.log("DESTROY")
		if (this.constructor.currentRoom == this)
			this.constructor.currentRoom = null
		this.constructor.removeRoom(this)
		
		this.chat_pane.remove()
		this.chat_pane.replaceChildren()
		this.userListInner = null
		this.messagePane = null
		
		this.scroller.destroy()
		this.scroller = null
		this.visible = false
		this.messageElements = {}
		Object.setPrototypeOf(this, null) // DIEEEEE
	}
	// todo: make renderuserlist etc.
	// reuse for sidebar + page userlist?
	shouldScroll() {
		return this.scroller.at_bottom
	}
	//
	insert_merge(part, comment, time, backwards) {
		Draw.insert_comment_merge(this.messageList, part, comment, time, backwards)
		this.totalMessages++
		this.messageElements[comment.id] = part
		this.limitMessages()
	}
	// "should be called in reverse order etc. etc. you know
	// times will be incorrect oh well"
	displayOldMessage(comment) {
		this.scroller.handlePrintTop(()=>{
			let old = this.messageElements[comment.id]
			if (comment.deleted) {
				this.removeMessage(comment.id)
			} else {
				// `old` should never be set here, I think...
				let node = Draw.message_part(comment)
				this.insert_merge(node, comment, null, true)
			}
		})
	}
	my_last_message() {
		return Object.values(this.messageElements).findLast((msg)=>{
			return msg && msg.x_data.createUserId == Req.uid
		})
	}
	displayMessage(comment, autoscroll) {
		this.scroller.handlePrint(()=>{
			let old = this.messageElements[comment.id]
			if (comment.deleted) {
				this.removeMessage(comment.id)
			} else {
				let part = Draw.message_part(comment)
				
				if (old) { // edited
					old.parentNode.replaceChild(part, old)
					this.messageElements[comment.id] = part
				} else { // new comment
					this.insert_merge(part, comment, this.lastTime, false)
					this.lastTime = comment.createDate //todo: improve
					View.commentTitle(comment)
				}
			}
		}, autoscroll != false)
	}
	
	showControls(elem) {
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
	
} // class ChatRoom

// todo: when starting to render any page
//- run generatestatus and generatelisteners
//- if changed, refresh long poller with new data
//- when rendering chat, we need to retrieve the listeners list from Req

// this would be a `static` method but we aren't ready to use those yet
ChatRoom.listening_rooms = function() {
	let list = [-1]
	for (let id in this.rooms)
		list.push(id)
	return list
}

ChatRoom.markup = "12y"

ChatRoom.generateStatus = function() {
	let status = {}
	for (let id in this.rooms)
		status[id] = this.rooms[id].status
	status[-1] = this.global.status
	return status
}

ChatRoom.rooms = {}

ChatRoom.updateUserAvatar = function(user) {
	Object.for(this.rooms, room => room.updateUserAvatar(user))
	this.global && this.global.updateUserAvatar(user)
}

ChatRoom.addRoom = function(room) {
	this.rooms[room.id] = room
	//ChatRoom.setViewing(Object.keys(ChatRoom.rooms))
}

ChatRoom.removeRoom = function(room) {
	if (this.currentRoom == room)
		this.currentRoom = null
	if (this.rooms[room.id] == room)
		delete this.rooms[room.id]
	//ChatRoom.setViewing(Object.keys(ChatRoom.rooms))
}

// unused
ChatRoom.setViewing = function(ids) {
	Lp.set_listening(ids)
	Lp.refresh()
}

ChatRoom.updateUserLists = function(a) {
	// why don't we just use .rooms[-1] instead of .global?
	a[-1] && this.global.updateUserList(a[-1])
	for (let id in a) {
		let room = this.rooms[id]
		room && room.updateUserList(a[id])
	}
}

ChatRoom.displayMessages = function(comments) {
	let displayedIn = {} // unused?
	comments.forEach((comment)=>{
		let room = this.rooms[comment.parentId]
		if (room) {
			room.displayMessage(comment)
			displayedIn[room.id] = true
		}
	})
}
