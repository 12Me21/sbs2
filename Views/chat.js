function ChatRoom(id, page) {
	var old = ChatRoom.rooms[id]
	if (old)
		return old
	this.page = page
	this.id = id
	this.lastUid = NaN
	this.lastBlock = null
	this.lastTime = 0
	this.userList = document.createElement('div')
	this.userList.className = "bar rem2-3 userlist"
	this.messagePane = document.createElement('div')
	this.messagePane.className = "chatScroller"
	this.messagePane.style.display = "none"
	this.userList.style.display = "none"
	$chatPane.appendChild(this.userList)
	$chatPane.appendChild(this.messagePane)
	this.messageList = document.createElement('div')
	this.messageList.className = "scrollInner"
	this.messagePane.appendChild(this.messageList)
	this.visible = false
	ChatRoom.addRoom(this)
}

ChatRoom.rooms = {}

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
		var d = document.createDocumentFragment()
		a[-1].forEach(function(item) {
			d.appendChild(Draw.linkAvatar(item.user))
		})
		$sidebarUserlist.replaceChildren(d)
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
	var d = document.createDocumentFragment()
	list.forEach(function(item) {
		d.appendChild(Draw.linkAvatar(item.user))
	})
	this.userList.replaceChildren(d)
}

ChatRoom.prototype.displayInitialMessages = function(comments) {
	var $ = this
	comments.forEach(function(comment) {
		$.displayMessage(comment, false)
	})
	// ugh why do we need this?
	window.setTimeout(function() {
		$.autoScroll(true)
	}, 0)
}

ChatRoom.prototype.autoScroll = function(instant) {
	var parent = this.messagePane
	if (!window.requestAnimationFrame || instant) {
		parent.scrollTop = parent.scrollHeight - parent.clientHeight
	} else {
		// only start a new animation if previous isn't already running
		if (!this.animationId) {
			this.autoScrollAnimation()
		}
	}
}

ChatRoom.prototype.scrollDistance = function() {
	var parent = this.messagePane
	return parent.scrollHeight-(parent.clientHeight)-parent.scrollTop
}

ChatRoom.prototype.autoScrollAnimation = function() {
	var $=this
	var parent = this.messagePane

	parent.scrollTop += Math.max(Math.ceil(this.scrollDistance()/4), 1)
	
	if (this.scrollDistance() > 0) {
		// save scroll position
		this.expectedTop = parent.scrollTop
		
		this.animationId = window.requestAnimationFrame(function(time) {
			// only call again if scroll pos has not changed
			// (if it has, that means the user probably scrolled manually)
			if ($.expectedTop == $.messagePane.scrollTop) {
				$.autoScrollAnimation()
			} else {
				$.animationId = null
			}
		})
	} else {
		this.animationId = null
	}
}

ChatRoom.prototype.show = function() {
	var old = ChatRoom.currentRoom
	if (old)
		old.hide()
	this.messagePane.style.display = ""
	this.userList.style.display = ""
	this.visible = true
	ChatRoom.currentRoom = this
}

ChatRoom.prototype.hide = function() {
	if (this.pinned) {
		this.messagePane.style.display = "none"
		this.userList.style.display = "none"
		if (ChatRoom.currentRoom == this)
			ChatRoom.currentRoom = null
		this.visible = false
	} else
		this.destroy()
}

ChatRoom.prototype.destroy = function() {
	ChatRoom.removeRoom(this)
	this.userList.remove()
	this.messagePane.remove()
	this.userList = null //gc
	this.scoller = null
	this.visible = false
}

ChatRoom.prototype.shouldScroll = function() {
	return this.scrollDistance() < (this.messagePane.clientHeight)*0.25
}

ChatRoom.prototype.displayMessage = function(comment, autoscroll) {
	var s = autoscroll != false && this.shouldScroll()
	if (comment.deleted)
		return
	var uid = comment.createUserId
	if (!this.lastBlock || uid != this.lastUid || comment.createDate-this.lastTime > 1000*60*5) {
		this.lastBlock = Draw.messageBlock(comment)
		this.messageList.appendChild(this.lastBlock[0])
		//lastTime = comment.createDate
	}
	this.lastBlock[1].appendChild(Draw.messagePart(comment))
	this.lastUid = uid
	this.lastTime = comment.createDate
	if (s)
		this.autoScroll()
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
	cleanUp: function() {
		//$messageList.replaceChildren()
		room.hide()
	},
	init: function() {
		$chatSend.onclick = function() {
			var msg = $chatTextarea.value
			var room = ChatRoom.currentRoom
			if (msg && room) {
				var meta = {}
				var markup = $chatMarkupSelect.value
				if (markup && markup!="plaintext")
					meta.m = markup
				if (Req.me)
					meta.a = Req.me.avatar
				Req.sendMessage(room.id, msg, meta, function() {
				})
			}
			$chatTextarea.value = ""
		}
		
		$chatTextarea.onkeypress = function(e) {
			if (!e.shiftKey && e.keyCode == 13) {
				e.preventDefault()
				$chatSend.onclick()
			}
		}
	}
})

<!--/*
}(window)) //*/ // pass external values
