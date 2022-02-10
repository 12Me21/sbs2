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
		
		// page
		this.pageContainer = document.createElement('div')
		this.pageContainer.className = 'split-top border-list'
		this.pageElement = document.createElement('div')
		this.pageElement.className = 'markup-root pageContents'
		this.pageInfoElement = Draw.pageInfo(page)
		this.pageContainer.append(this.pageInfoElement)
		this.pageContainer.append(this.pageElement)
		$pageContents.append(this.pageContainer)
		
		// user list
		let ul = Draw.userList()
		this.userListOuter = ul[0]
		this.userListInner = ul[1]
		ul[2].onclick = ()=>{
			this.toggleHiding(()=>{
				ul[2].disabled = false
			})
			ul[2].disabled = true
		}
		this.userListOuter.hidden = true
		$chatPane.append(this.userListOuter)
		
		// chat
		this.messageElements = {}
		this.lastTime = 0
		this.maxMessages = 500
		this.totalMessages = 0
		
		;[this.messagePane, this.messageList] = Draw.chatMessagePane()
		
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
		$chatPane.append(this.messagePane)
		
		this.controlId = null
		let controls = Draw.messageControls()
		controls.onclick = ()=>{
			if (this.controlId)
				window.editComment(this.controlId)
		}
		this.controls = controls.elem
		
		this.messageList.addEventListener('focusin', (e)=>{
			let elem = e.target
			while (elem != this.messageList && elem instanceof HTMLElement) {
				if (elem.tagName == 'MESSAGE-PART') {
					this.showControls(elem)
					break
				}
				elem = elem.parentNode
			}
		})
		this.messageList.addEventListener('focusout', (e)=>{
			this.showControls(null)
		})
		
		this.messageList.onmouseover = (e)=>{
			let elem = e.target
			while (elem != this.messageList && elem instanceof HTMLElement) {
				if (elem.tagName == 'MESSAGE-PART') {
					this.showControls(elem)
					return
				}
				if (elem.tagName == 'MESSAGE-CONTROLS')
					return
				elem = elem.parentNode
			}
			this.showControls(null)
		}
		this.messageList.onmouseleave = (e)=>{
			this.showControls(null)
		}
		
		this.showChat = page.type == "@page.discussion"
		
		this.visible = false
		this.pinned = false
		this.scroller = new Scroller(this.messagePane, this.messageList)
		this.updatePage(page)
		let l = Lp.processedListeners[id] //should this be done with id -1? // what?
		l && this.updateUserList(l)
		this.constructor.addRoom(this)
		
		if (this.page.type == 'resource')
			this.pageContainer.style.height = "1000px" //whatever
		else if (this.page.type == 'chat')
			this.pageContainer.style.height = "0"
		//this.pageContainer.style.maxHeight = '40vh'
		View.attachResize(this.pageContainer, $chatResize, false, 1)
	}
	
	loadOlder(num, callback) {
		for (let firstId in this.messageElements)
			break
		Req.getCommentsBefore(this.id, +firstId, num, (comments)=>{
			comments && comments.forEach(c => this.displayOldMessage(c))
			callback()
		})
	}
	
	// "should be called in reverse order etc. etc. you know
	// times will be incorrect oh well"
	displayOldMessage(comment) {
		this.scroller.handlePrintTop(()=>{
			let old = this.messageElements[comment.id]
			if (comment.deleted) {
				// deleted
				if (old) {
					let contents = old.parentNode
					old.remove()
					if (!contents.firstChild)
						contents.parentNode.remove()
				}
			} else {
				// `old` should never be set here, I think...
				let firstUidBlock = this.messageList.firstChild
				let firstHash, newHash
				if (firstUidBlock) {
					firstHash = firstUidBlock.dataset.merge
					if (!firstHash)
						firstUidBlock = null
					else
						newHash = Draw.mergeHash(comment)
				}
				let node = Draw.messagePart(comment)
				let contents
				if (firstUidBlock && newHash == firstHash) {
					contents = firstUidBlock.getElementsByTagName('message-contents')[0]// not great...
				} else {
					let b = Draw.messageBlock(comment)
					this.messageList.prepend(b[0])
					contents = b[1]
				}
				contents.prepend(node)
				if (!this.messageElements[comment.id])
					this.totalMessages++
				this.messageElements[comment.id] = node
				this.limitMessages()
			}
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
			...Object.values(list).map(item => Draw.userListAvatar(item))
		)
	}
	displayInitialMessages(comments, pinned) {
		comments.forEach(comment => this.displayMessage(comment, false))
		if (pinned && this.pinnedList) {
			pinned.forEach((comment)=>{
				let b = Draw.messageBlock(comment)
				this.pinnedList.append(b[0])
				b[1].append(Draw.messagePart(comment))
			})
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
		this.messagePane.hidden = false
		this.userListOuter.hidden = false
		this.pageContainer.hidden = false
		this.visible = true
		this.constructor.currentRoom = this
	}
	hide() {
		if (this.pinned) {
			this.messagePane.hidden = true
			this.userListOuter.hidden = true
			this.pageContainer.hidden = true
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
		this.userListOuter.remove()
		this.messagePane.remove()
		this.pageContainer.remove()
		this.userListOuter = null //gc
		this.userListInner = null
		this.scroller.destroy()
		this.scroller = null
		this.visible = false
		this.messageElements = {}
		Object.setPrototypeOf(this, null) // DIEEEEE
	}
	// todo: make renderuserlist etc.
	// reuse for sidebar + page userlist?
	shouldScroll() {
		return this.scroller.atBottom
	}
	displayMessage(comment, autoscroll) {
		this.scroller.handlePrint(()=>{
			let old = this.messageElements[comment.id]
			if (comment.deleted) {
				// deleted
				if (old) {
					let contents = old.parentNode
					old.remove()
					if (!contents.firstChild) // remove parent if empty
						contents.parentNode.remove()
				}
			} else {
				let part = Draw.messagePart(comment)
				if (old) { // edited
					old.parentNode.replaceChild(part, old)
				} else { // new comment
					let lastBlock = this.messageList.lastChild
					let lastHash, newHash
					if (lastBlock) {
						lastHash = lastBlock.dataset.merge
						if (!lastHash)
							lastBlock = null
						else
							newHash = Draw.mergeHash(comment)
					}
					let contents
					if (lastBlock && lastHash == newHash && comment.createDate-this.lastTime <= 1000*60*5) { // insert in current block
						contents = lastBlock.getElementsByTagName('message-contents')[0]// not great...
					} else { //create new block
						let b = Draw.messageBlock(comment)
						this.messageList.append(b[0])
						contents = b[1]
					}
					contents.append(part)
					
					this.lastTime = comment.createDate //todo: improve
					
					View.commentTitle(comment)
				}
				if (!this.messageElements[comment.id])
					this.totalMessages++
				this.messageElements[comment.id] = part
				this.limitMessages()
			}
		}, autoscroll != false)
	}
	// should maybe take id instead of element?
	showControls(elem) {
		if (elem) {
			elem.parentNode.insertBefore(this.controls, elem)
			this.controlId = +elem.dataset.id
		} else {
			this.controls.remove()
			this.controlId = null
		}
	}
	
} // class ChatRoom

// todo: when starting to render any page
//- run generatestatus and generatelisteners
//- if changed, refresh long poller with new data
//- when rendering chat, we need to retrieve the listeners list from Req

// this would be a `static` method but we aren't ready to use those yet
ChatRoom.generateListeners = function(old) {
	let listeners = {}
	old = old || {}
	for (let id in this.rooms)
		listeners[id] = old[id] || {'0':""}
	listeners[-1] = old[-1] || {'0':""}
	return listeners
}

ChatRoom.markup = "12y"

ChatRoom.generateStatus = function() {
	let status = {}
	for (let id in this.rooms)
		status[id] = this.rooms[id].status
	status[-1] = this.global.status
	return status
}

ChatRoom.updateStatus = function() {
	Lp.lpSetStatus(this.generateStatus())
}

ChatRoom.rooms = {}

ChatRoom.updateUserAvatar = function(user) {
	this.rooms.forEach(room => room.updateUserAvatar(user))
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

ChatRoom.setViewing = function(ids) {
	Lp.lpSetListening(ids)
	Lp.lpRefresh()
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
