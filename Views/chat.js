function ChatRoom(id, page) {
	var old = ChatRoom.rooms[id]
	if (old)
		return old
	var $ = this
	this.id = id
	this.userList = {}
	if (id == -1) {
		this.userListInner = $sidebarUserList
		return
	}
	this.messageElements = {}
	this.status = "active"
	this.page = page
	this.lastUid = NaN
	this.lastBlock = null
	this.lastTime = 0
	var ul = Draw.userList()
	this.userListOuter = ul[0]
	this.userListInner = ul[1]
	ul[2].onclick = function() {
		$.toggleHiding(function() {
			ul[2].disabled = false
		})
		ul[2].disabled = true
	}
	this.messagePane = document.createElement('div')
	this.messagePane.className = "chatScroller scrollOuter"
	this.messagePane.style.display = "none"
	this.userListOuter.style.display = "none"
	$chatPane.appendChild(this.userListOuter)
	$chatPane.appendChild(this.messagePane)
	this.messageList = document.createElement('div')
	this.messageList.className = "scrollInner"
	this.messagePane.appendChild(this.messageList)
	this.visible = false
	this.scroller = new Scroller(this.messagePane, this.messageList)
	ChatRoom.addRoom(this)
}

ChatRoom.generateStatus = function() {
	var status = {}
	for (var id in ChatRoom.rooms) {
		status[id] = ChatRoom.rooms[id].status
	}
	status[-1] = ChatRoom.global.status
	return status
}

ChatRoom.updateStatus = function() {
	Req.lpSetStatus(ChatRoom.generateStatus())
}

ChatRoom.rooms = {}

ChatRoom.updateUserAvatar = function(user) {
	for (var id in ChatRoom.rooms) {
		ChatRoom.rooms[id].updateUserAvatar(user)
	}
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
		console.log("UPDATE?", hidden)
		$.updateUserList($.userList)
		callback && callback()
	})
}

ChatRoom.prototype.updateUserAvatar = function(user) {
	for (var uid in this.userList) {
		if (this.userList[uid].user.id == user.id) {
			this.userList[uid].user = user
			this.updateUserList(this.userList)
			break
		}
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
	ChatRoom.setViewing(Object.keys(ChatRoom.rooms))
}

ChatRoom.removeRoom = function(room) {
	if (ChatRoom.currentRoom == room)
		ChatRoom.currentRoom = null
	if (ChatRoom.rooms[room.id] == room)
		delete ChatRoom.rooms[room.id]
	ChatRoom.setViewing(Object.keys(ChatRoom.rooms))
}

ChatRoom.setViewing = function(ids) {
	Req.lpSetListening(ids)
	Req.lpRefresh()
}

ChatRoom.updateUserLists = function(a) {
	if (a[-1]) {
		ChatRoom.global.updateUserList(a[-1])
	}
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

// 8:10;35

ChatRoom.prototype.show = function() {
	var old = ChatRoom.currentRoom
	if (old)
		old.hide()
	this.messagePane.style.display = ""
	this.userListOuter.style.display = ""
	this.visible = true
	ChatRoom.currentRoom = this
}

ChatRoom.prototype.hide = function() {
	if (this.pinned) {
		this.messagePane.style.display = "none"
		this.userListOuter.style.display = "none"
		if (ChatRoom.currentRoom == this)
			ChatRoom.currentRoom = null
		this.visible = false
	} else
		this.destroy()
}

ChatRoom.prototype.destroy = function() {
	ChatRoom.removeRoom(this)
	this.userListOuter.remove()
	this.messagePane.remove()
	this.userListOuter = null //gc
	this.userListInner = null
	this.scroller.destroy()
	this.scroller = null
	this.visible = false
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
			if (old)
				old.remove()
		} else {
			var part = Draw.messagePart(comment)
			if (old) {
				old.parentNode.replaceChild(part, old)
			} else {
				var uid = comment.createUserId
				if (!$.lastBlock || uid != $.lastUid || comment.createDate-$.lastTime > 1000*60*5) {
					$.lastBlock = Draw.messageBlock(comment)
					var ret = $.lastBlock[0]
				}
				$.lastBlock[1].appendChild(part)
				$.lastUid = uid
				$.lastTime = comment.createDate
				return ret
			}
			$.messageElements[comment.id] = part
		}
	}, autoscroll != false)
}

<!--/* trick indenter
with (View) (function($) { "use strict" //*/

var room

addView('chat', {
	// in this case, we sometimes make a request, and sometimes
	// load the page instantly because the chatroom is cached
	// so, call either `render` or `quick`
	// the function passed to quick will act like a simple view
	// with no `start` method (is called immediately)
	// DO NOT CALL BOTH FUNCTIONS!
	start: function(id, query, render, quick) {
		var room = ChatRoom.rooms[id]
		if (room) {
			quick(function() {
				var page = room.page
				Nav.link("page/"+page.id, $pagePageLink)
				setEntityTitle(page)
				setEntityPath(page)
				//ChatRoom.setViewing([page.id])
				room.show()
			})
		} else {
			//todo: maybe we can request the user list early too?
			// the problem is, if we create the room early,
			// we might get messages from long polling before
			// loading the initial messages :(
			return $.Req.getChatView(id, render)
		}
	},
	className: 'chatMode',
	render: function(page, comments) {
		//ChatRoom.setViewing([page.id])
		Nav.link("page/"+page.id, $pagePageLink)
		setEntityTitle(page)
		setEntityPath(page)
		room = new ChatRoom(page.id, page)
		room.displayInitialMessages(comments)
		room.show()
	},
	cleanUp: function(type) {
		//$messageList.replaceChildren()
		room.hide()
	},
	init: function() {
		$chatSend.onclick = function() {
			var msg = $chatTextarea.value
			var room = ChatRoom.currentRoom
			if (msg && room) {
				var meta = {}
				var markup = $chatMarkupSelect.checked ? "12y" : "plaintext"
				if (markup && markup!="plaintext")
					meta.m = markup
				if (Req.me)
					meta.a = Req.me.avatar
				Req.sendMessage(room.id, msg, meta, function() {
				})
			}
			$chatTextarea.value = ""
		}//todo: make a readInput and writeInput, for getting/setting the state of the textbox and markup select
		// (to use with editing etc. too)
		
		$chatTextarea.onkeypress = function(e) {
			if (!e.shiftKey && e.keyCode == 13) {
				e.preventDefault()
				$chatSend.onclick()
			}
		}
		// TODO: make sure this is ready when the long poller starts!
		// right now it PROBABLY will be but that isn't certain
		// the long poller could technically start before onload
		ChatRoom.global = new ChatRoom(-1)

		$hideGlobalStatusButton.onclick = function() {
			if ($hideGlobalStatusButton.disabled)
				return
			$hideGlobalStatusButton.disabled = true
			ChatRoom.global.toggleHiding(function() {
				$hideGlobalStatusButton.disabled = false
			})
		}
		
	}
})

<!--/*
}(window)) //*/ // pass external values





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
