function ChatRoom(id, page) {
	var old = ChatRoom.rooms[id]
	if (old)
		return old
	this.id = id
	this.userList = []
	if (id == -1) {
		this.userListElem = $sidebarUserList
		return
	}
	this.page = page
	this.lastUid = NaN
	this.lastBlock = null
	this.lastTime = 0
	this.userListElem = document.createElement('div')
	this.userListElem.className = "bar rem2-3 userlist"
	this.messagePane = document.createElement('div')
	this.messagePane.className = "chatScroller"
	this.messagePane.style.display = "none"
	this.userListElem.style.display = "none"
	$chatPane.appendChild(this.userListElem)
	$chatPane.appendChild(this.messagePane)
	this.messageList = document.createElement('div')
	this.messageList.className = "scrollInner"
	this.messagePane.appendChild(this.messageList)
	this.visible = false
	ChatRoom.addRoom(this)
	var $ = this
	$.atBottom = true
	$.messagePane.addEventListener('scroll', function(e) {
		if ($.ignoreScroll) {
			$.ignoreScroll = false
			return
		}
		if ($.scrollDistance() < $.messagePane.clientHeight/4) {
			$.atBottom = true
		} else {
			$.atBottom = false
		}
	}, {passive: true})
	function onResize() {
		if ($.atBottom && !$.animationId) // when message is inserted, it triggers the resize detector, which would interrupt the scroll animation, so we don't force scroll if an animation is playing
			$.autoScroll(true)
	}
	TrackScrollResize(this.messagePane, onResize)
	TrackScrollResize(this.messageList, onResize)
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
	Req.toggleHiding(this.id, callback || function(){})
}

ChatRoom.prototype.updateUserAvatar = function(user) {
	for (var i=0; i<this.userList.length; i++) {
		if (this.userList[i].user.id == user.id) {
			this.userList[i].user = user
			this.updateUserList(this.userList)
			break
		}
	}
}

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

ChatRoom.userList = []

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
	list.forEach(function(item) {
		d.appendChild(Draw.userListAvatar(item))
	})
	this.userListElem.replaceChildren(d)
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
	if (instant)
		this.ignoreScroll = true
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

	this.atBottom = true; // maybe should only be when finished, probably doesn't matter though
	
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
	this.userListElem.style.display = ""
	this.visible = true
	ChatRoom.currentRoom = this
}

ChatRoom.prototype.hide = function() {
	if (this.pinned) {
		this.messagePane.style.display = "none"
		this.userListElem.style.display = "none"
		if (ChatRoom.currentRoom == this)
			ChatRoom.currentRoom = null
		this.visible = false
	} else
		this.destroy()
}

ChatRoom.prototype.destroy = function() {
	ChatRoom.removeRoom(this)
	TrackScrollResize(this.messageList, null)
	TrackScrollResize(this.messagePane, null)
	this.userListElem.remove()
	this.messagePane.remove()
	this.userListElem = null //gc
	this.scoller = null
	this.visible = false
	
}

// todo: make renderuserlist etc.
// reuse for sidebar + page userlist?

ChatRoom.prototype.shouldScroll = function() {
	return this.atBottom//this.scrollDistance() < (this.messagePane.clientHeight)*0.25
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
		// TODO: make sure this is ready when the long poller starts!
		// right now it PROBABLY will be but that isn't certain
		// the long poller could technically start before onload
		ChatRoom.global = new ChatRoom(-1)

		$hideGlobalStatusButton.onclick = function() {
			if ($hideGlobalStatusButton.disabled)
				return
			$hideGlobalStatusButton.disabled = true
			console.log($hideGlobalStatusButton.disabled)
			ChatRoom.global.toggleHiding(function() {
				$hideGlobalStatusButton.disabled = false
			})
		}
	}
})

<!--/*
}(window)) //*/ // pass external values
