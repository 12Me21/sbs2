// a lot of this (especially message inserting/removing) really needs to be cleaned up...

function ChatRoom(id, page) {
	var $=this
	var old = ChatRoom.rooms[id]
	if (old)
		return old
	
	this.id = id
	this.status = "active"
	this.userList = [] //did this get deleted accidentally???
	
	if (id <= 0) {
		this.userListInner = $sidebarUserList
		return
	}

	// page
	this.pageContainer = document.createElement('div')
	this.pageContainer.className = "split-top"
	this.pageElement = document.createElement('div')
	this.pageElement.className = "markup-root pageContents"
	this.pageInfoElement = Draw.pageInfo(page)
	this.pageContainer.appendChild(this.pageInfoElement)
	this.pageContainer.appendChild(this.pageElement)
	$pageContents.appendChild(this.pageContainer)

	// user list
	var ul = Draw.userList()
	this.userListOuter = ul[0]
	this.userListInner = ul[1]
	ul[2].onclick = function() {
		$.toggleHiding(function() {
			ul[2].disabled = false
		})
		ul[2].disabled = true
	}
	this.userListOuter.hidden = true
	$chatPane.appendChild(this.userListOuter)
		
	// chat
	this.messageElements = {}
	this.lastTime = 0
	this.maxMessages = 500
	this.totalMessages = 0

	var b = Draw.chatMessagePane()
	this.messagePane = b[0]
	this.messageList = b[1]
	var b = Draw.button()
	b[1].textContent = "load older messages"
	b[1].onclick = function() {
		if (b[1].disabled)
			return
		b[1].disabled = true
		$.loadOlder(50, function() {
			b[1].disabled = false
		}) //todo: lock
	}
	this.messagePane.prependChild(b[0])
	this.messagePane.setAttribute('data-id', page.id)
	$chatPane.appendChild(this.messagePane)

	this.controlId = null
	var controls = Draw.messageControls()
	controls.onclick = function() {
		if ($.controlId)
			window.editComment($.controlId)
	}
	this.controls = controls.elem

	this.messageList.addEventListener('focusin', function(e) {
		var elem = e.target
		while (elem != $.messageList && elem instanceof HTMLElement) {
			if (elem.tagName == "MESSAGE-PART") {
				$.showControls(elem)
				break
			}
			elem = elem.parentNode
		}
	})
	this.messageList.addEventListener('focusout', function(e) {
		$.showControls(null)
	})

	this.messageList.onmouseover = function(e) {
		var elem = e.target
		while (elem != $.messageList && elem instanceof HTMLElement) {
			if (elem.tagName == "MESSAGE-PART") {
				$.showControls(elem)
				return
			}
			if (elem.tagName == "MESSAGE-CONTROLS")
				return
			elem = elem.parentNode
		}
		$.showControls(null)
	}
	this.messageList.onmouseleave = function(e) {
		$.showControls(null)
	/*	if (e.target == $.messageList)
			
		return
		var elem = e.target
		while (elem != $.messageList && elem instanceof HTMLElement) {
			if (elem.tagName == "MESSAGE-PART") {
				$.showControls(null)
				break
			}
			elem = elem.parentNode
		}*/
	}
	
	this.showChat = page.type == "@page.discussion"
	
	this.visible = false
	this.scroller = new Scroller(this.messagePane, this.messageList)
	this.updatePage(page)
	var l = Req.lpProcessedListeners[id] //should this be done with id -1? // what?
	l && this.updateUserList(l)
	ChatRoom.addRoom(this)

	if (this.page.type == "resource")
		;
	//	this.pageContainer.style.height = "1000px" //whatever
	else if (this.page.type == "chat")
		this.pageContainer.style.height = "0"
	View.attachResize(this.pageContainer, $chatResize, false, 1)
}

// todo: when starting to render any page
//- run generatestatus and generatelisteners
//- if changed, refresh long poller with new data
//- when rendering chat, we need to retrieve the listeners list from Req
ChatRoom.generateListeners = function(old) {
	var listeners = {}
	old = old || {}
	for (var id in ChatRoom.rooms)
		listeners[id] = old[id] || {"0":""}
	listeners[-1] = old[-1] || {"0":""}
	return listeners
}

ChatRoom.prototype.loadOlder = function(num, callback) {
	var $=this
	for (var firstId in this.messageElements)
		break
	Req.getCommentsBefore(this.id, firstId, num, function(comments) {
		comments && comments.forEach(function(c) {
			$.displayOldMessage(c)
		})
		callback()
	})
}

// "should be called in reverse order etc. etc. you know
// times will be incorrect oh well"
ChatRoom.prototype.displayOldMessage = function(comment) {
	var $=this
	this.scroller.handlePrintTop(function(){
		var old = $.messageElements[comment.id]
		if (comment.deleted) {
			// deleted
			if (old) {
				var contents = old.parentNode
				old.remove()
				if (!contents.firstChild)
					contents.parentNode.remove()
			}
		} else {
			// `old` should never be set here, I think...
			var firstUidBlock = $.messageList.firstChild
			if (firstUidBlock) {
				var firstUid = firstUidBlock.getAttribute('data-uid')
				if (!firstUid)
					firstUidBlock = null
				else
					firstUid = +firstUid
			}
			var id = comment.id
			var uid = comment.createUserId
			var node = Draw.messagePart(comment)
			if (uid && firstUid == uid && firstUidBlock) {
				var contents = firstUidBlock.getElementsByTagName('message-contents')[0]// not great...
			} else {
				var b = Draw.messageBlock(comment)
				$.messageList.prependChild(b[0])
				contents = b[1]
			}
			contents.prependChild(node)
			if (!$.messageElements[comment.id])
				$.totalMessages++
			$.messageElements[id] = node
			$.limitMessages()
		}
	})
}

ChatRoom.prototype.limitMessages = function() {
	for (var id in this.messageElements) {
		if (this.totalMessages <= this.maxMessages)
			break
		if (!this.removeMessage(id))
			break //fail
	}
}

ChatRoom.prototype.removeMessage = function(id) {
	var message = this.messageElements[id]
	if (!message)
		return false
	
	var parent = message.parentNode
	
	message.remove()
	delete this.messageElements[id]
	this.totalMessages--
	
	if (!parent.firstChild)
		parent.parentNode.remove()
	
	return true
}

ChatRoom.generateStatus = function() {
	var status = {}
	for (var id in ChatRoom.rooms)
		status[id] = ChatRoom.rooms[id].status
	status[-1] = ChatRoom.global.status
	return status
}

ChatRoom.updateStatus = function() {
	Req.lpSetStatus(ChatRoom.generateStatus())
}

ChatRoom.rooms = {}

ChatRoom.updateUserAvatar = function(user) {
	for (var id in ChatRoom.rooms)
		ChatRoom.rooms[id].updateUserAvatar(user)
	if (ChatRoom.global)
		ChatRoom.global.updateUserAvatar(user)
}

ChatRoom.prototype.toggleHiding = function(callback) {
	var $=this
	Req.toggleHiding(this.id, function(hidden) {
		if (hidden)
			delete $.userList[Req.uid]
		else
			$.userList[Req.uid] = {user: Req.me, status: "unknown"}
		$.updateUserList($.userList)
		callback && callback()
	})
}

ChatRoom.prototype.updateUserAvatar = function(user) {
	for (var uid in this.userList)
		if (this.userList[uid].user.id == user.id) {
			this.userList[uid].user = user
			this.updateUserList(this.userList)
			break
		}
}
// silly
Object.defineProperty(ChatRoom.prototype, 'scrollBottom', {
	get: function() {
		var parent = this.messagePane
		return parent.scrollHeight-parent.clientHeight-parent.scrollTop
	},
	set: function(value) {
		var parent = this.messagePane
		// need to round here because it would be reversed otherwise
		value = Math.floor(value*window.devicePixelRatio)/window.devicePixelRatio
		parent.scrollTop = parent.scrollHeight-parent.clientHeight-value
	}
})

ChatRoom.addRoom = function(room) {
	ChatRoom.rooms[room.id] = room
	//ChatRoom.setViewing(Object.keys(ChatRoom.rooms))
}

ChatRoom.removeRoom = function(room) {
	if (ChatRoom.currentRoom == room)
		ChatRoom.currentRoom = null
	if (ChatRoom.rooms[room.id] == room)
		delete ChatRoom.rooms[room.id]
	//ChatRoom.setViewing(Object.keys(ChatRoom.rooms))
}

ChatRoom.setViewing = function(ids) {
	Req.lpSetListening(ids)
	Req.lpRefresh()
}

ChatRoom.updateUserLists = function(a) {
	if (a[-1])
		ChatRoom.global.updateUserList(a[-1])
	for (var id in a) {
		var room = ChatRoom.rooms[id]
		if (room)
			room.updateUserList(a[id])
	}
}

ChatRoom.displayMessages = function(comments) {
	var displayedIn = {}
	comments.forEach(function(comment) {
		var room = ChatRoom.rooms[comment.parentId]
		if (room) {
			room.displayMessage(comment)
			displayedIn[room.id] = true
		}
	})
}

ChatRoom.prototype.updateUserList = function(list) {
	this.userList = list
	var d = document.createDocumentFragment()
	for (var uid in list)
		d.appendChild(Draw.userListAvatar(list[uid]))
	this.userListInner.replaceChildren(d)
}

ChatRoom.prototype.displayInitialMessages = function(comments) {
	var $ = this
	comments.forEach(function(comment) {
		$.displayMessage(comment, false)
	})
	// ugh why do we need this?
	window.setTimeout(function() {
		$.scroller.scrollInstant()
	}, 0)
}

ChatRoom.prototype.updatePage = function(page) {
	this.page = page
	this.pageElement.replaceChildren(Parse.parseLang(page.content, page.values.markupLang))
}

// 8:10;35

ChatRoom.prototype.show = function() {
	var old = ChatRoom.currentRoom
	if (old && old!=this)
		old.hide()
	this.messagePane.hidden = false
	this.userListOuter.hidden = false
	this.pageContainer.hidden = false
	this.visible = true
	ChatRoom.currentRoom = this
}

ChatRoom.prototype.hide = function() {
	if (this.pinned) {
		this.messagePane.hidden = true
		this.userListOuter.hidden = true
		this.pageContainer.hidden = true
		if (ChatRoom.currentRoom == this)
			ChatRoom.currentRoom = null
		this.visible = false
	} else
		this.destroy()
}

ChatRoom.prototype.destroy = function() {
	console.log("DESTROY")
	if (ChatRoom.currentRoom == this)
		ChatRoom.currentRoom = null
	ChatRoom.removeRoom(this)
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

ChatRoom.prototype.shouldScroll = function() {
	return this.scroller.atBottom
}

ChatRoom.prototype.displayMessage = function(comment, autoscroll) {
	var $=this
	this.scroller.handlePrint(function() {
		var old = $.messageElements[comment.id]
		if (comment.deleted) {
			// deleted
			if (old) {
				var contents = old.parentNode
				old.remove()
				if (!contents.firstChild)
					contents.parentNode.remove()
			}
		} else {
			var part = Draw.messagePart(comment)
			if (old) { // edited
				old.parentNode.replaceChild(part, old)
			} else { // new comment
					var lastUidBlock = $.messageList.lastChild
				if (lastUidBlock) {
					var lastUid = lastUidBlock.getAttribute('data-uid')
					if (!lastUid)
						lastUidBlock = null
					else
						lastUid = +lastUid
				}
				var id = comment.id
				var uid = comment.createUserId
				
				if (uid && lastUid == uid && lastUidBlock && comment.createDate-$.lastTime <= 1000*60*5) { // insert in current block
					var contents = lastUidBlock.getElementsByTagName('message-contents')[0]// not great...
				} else { //create new block
					var b = Draw.messageBlock(comment)
					$.messageList.appendChild(b[0])
					contents = b[1]
				}
				contents.appendChild(part)
				
				$.lastTime = comment.createDate //todo: improve
				
				View.commentTitle(comment)
			}
			if (!$.messageElements[comment.id])
				$.totalMessages++
			$.messageElements[comment.id] = part
			$.limitMessages()
		}
	}, autoscroll != false)
}

// should maybe take id instead of element?
ChatRoom.prototype.showControls = function(elem) {
	if (!elem) {
		this.controls.remove()
		this.controlId = null
		return
	}
	elem.parentNode.insertBefore(this.controls, elem)
	this.controlId = +elem.getAttribute('data-id')
}
