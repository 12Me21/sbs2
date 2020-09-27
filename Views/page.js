<!--/* trick indenter
with (View) (function($) { "use strict" //*/

var room

addView('page', {
	// in this case, we sometimes make a request, and sometimes
	// load the page instantly because the chatroom is cached
	// so, call either `render` or `quick`
	// the function passed to quick will act like a simple view
	// with no `start` method (is called immediately)
	// DO NOT CALL BOTH FUNCTIONS!
	start: function(id, query, render, quick) {
		var room = ChatRoom.rooms[id]
		if (room) {
			var z = room.pinned
			room.pinned = true
			quick(function() {
				var page = room.page
				setEntityTitle(page)
				setEntityPath(page)
				//ChatRoom.setViewing([page.id])
				room.show()
				room.pinned = z
			})
		} else {
			//todo: maybe we can request the user list early too?
			// the problem is, if we create the room early,
			// we might get messages from long polling before
			// loading the initial messages :(
			return Req.getChatView(id, render)
		}
	},
	className: 'page',
	splitView: true,
	render: function(page, comments) {
		//ChatRoom.setViewing([page.id])
		setEntityTitle(page)
		setEntityPath(page)
		room = new ChatRoom(page.id, page)
		room.displayInitialMessages(comments)
		room.show()
	},
	cleanUp: function(type) {
		//$messageList.replaceChildren()
		if (room)
			room.hide() //so it's fucking possible for cleanup to get called TWICE if there's an error, sometimes.
		room = null
	},
	init: function() {
		$chatSend.onclick = function() {
			var data = readInput()
			var room = ChatRoom.currentRoom
			if (room && data.content) {
				var old = data
				Req.sendMessage(room.id, data.content, data.meta, function(e) {
					if (e) {
						//error sending message
						writeData(old)
					}
				})
				$chatTextarea.value = "" //hack?
			}
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
			ChatRoom.global.toggleHiding(function() {
				$hideGlobalStatusButton.disabled = false
			})
		}
	}
})

function readInput() {
	var data = {
		meta: {},
		content: $chatTextarea.value,
	}
	
	if ($chatMarkupSelect.checked)
		data.meta.m = "12y"
	if (Req.me)
		data.meta.a = Req.me.avatar
	
	return data
}

function writeInput(data) {
	$chatTextarea.value = data.content || ""
	$chatMarkupSelect.checked = data.meta.m == "12y"
}

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
