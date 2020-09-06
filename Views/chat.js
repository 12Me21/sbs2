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
	this.messagePane.className = "scrollInner"
	this.messagePane.style.display = "none"
	this.userList.style.display = "none"
	$chatPane.appendChild(this.userList)
	$chatPane.appendChild(this.messagePane)
	this.messageList = this.messagePane // for now
	this.visible = false
	ChatRoom.rooms[id] = this
}

ChatRoom.rooms = {}

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

ChatRoom.prototype.displayInitialMessages = function(comments) {
	var $ = this
	comments.forEach(function(comment) {
		$.displayMessage(comment, false)
	})
//	window.setTimeout(function() {
		$.autoScroll(true)
//	}, 0)
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
	this.messagePane.style.display = "none"
	this.userList.style.display = "none"
	if (ChatRoom.currentRoom == this)
		ChatRoom.currentRoom = null
	this.visible = false
}

ChatRoom.prototype.destroy = function() {
	if (ChatRoom.currentRoom == this)
		ChatRoom.currentRoom = null
	this.userList.remove()
	this.messagePane.remove()
	this.userList = null //gc
	this.scoller = null
	this.visible = false
}

ChatRoom.prototype.displayMessage = function(comment) {
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
				room.show()
			})
		} else {
			return $.Req.getChatView(id, render)
		}
	},
	className: 'chatMode',
	render: function(page, comments) {
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
	}
})

<!--/*
}(window)) //*/ // pass external values
