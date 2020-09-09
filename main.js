/*window.onerror = function(message, source, line, col, error) {
	console.log("e")
}*/

Req.onLogin = function() {
	View.flag('loggedIn', true)
	Req.getMe(function(user) {
		View.updateMyUser(user) //also sets Req.me...
	})
	// display user info etc.
	// start long poller
	Req.onMessages = function(comments) {
		ChatRoom.displayMessages(comments)
	}
	Req.onListeners = function(a) {
		ChatRoom.updateUserLists(a)
	}
	Req.onActivity = function(a) {
		a.forEach(function(a) {
			if (a.type == 'user') {
				View.updateUserAvatar(a.content)
			}
		})
	}

	Req.doListenInitial(function(e, resp) {
		if (!e) {
			resp.systemaggregate.forEach(function(item) {
				if (item.type == "actionMax")
					Req.lpLastId = item.id
			})
			console.log("staring long poller")
			Req.lpStart()
			//sbm(resp, true)
			//todo:
			// keep an updated list of recently active pages
			//
		}
	})
	
	// update currently viewed page (in case page was hidden)
}

Req.onLogout = function() {
	View.flag('loggedIn', false)
	// this should probably just reload the entire site just to be safe
	// if not, need to:
	// stop long poller
	// clear generated html
	// reload current page in case it's not public
	// etc.
}

if (document.readyState == 'loading')
	document.addEventListener('DOMContentLoaded', ready)
else {
	ready()
}

function ready() {
	console.log("ONLOAD!")
	if (navigator.vendor=="Google Inc.") {
		console.info("chrome sucks")
		var x = document.createElement('style')
		x.textContent = "img, .iconBg { image-rendering: -webkit-optimize-contrast; }"
		document.head.appendChild(x)
	}

	Nav.initial()

	View.onLoad()
}

Req.tryLoadCachedAuth()
