Sidebar.print("hi!")
delete window.sidebar // obsolete firefox global variable

/*window.onerror = function(message, source, line, col, error) {
	console.log("e")
}*/

Req.onLogin = function() {
	View.flag('loggedIn', true)
	/*Req.getMe(function(user) {
		View.updateMyUser(user) //also sets Req.me...
	})*/
	// display user info etc.
	// start long poller
	var aggregate = {}
	Req.onMessages = function(comments) {
		ChatRoom.displayMessages(comments)
		Entity.updateAggregateComments(aggregate, comments)
		Sidebar.onAggregateChange(aggregate)
	}
	Req.onListeners = function(a) {
		ChatRoom.updateUserLists(a)
	}
	Req.onActivity = function(a) {
		a.forEach(function(a) {
			if (a.type == 'user')
				View.updateUserAvatar(a.content)
		})
		Entity.updateAggregateActivity(aggregate,a)
		Sidebar.onAggregateChange(aggregate) //todo: this currently fires twice sometimes, technically
	}
	
	console.log("staring long poller")
	Req.lpStart(function(e, resp) {
		if (!e) {
			var me = resp.chains.Ume
			if (me && me[0])
				View.updateMyUser(me[0]) //also sets Req.me...
		} else {
			alert("INITIAL LONG POLL FAILED!")
		}
	})

	Req.getRecentActivity(function(a) {
		aggregate = a //needs to be update instead
		Sidebar.onAggregateChange(aggregate)
		// get rid of combined update functon and just call UAA and UAC
	})

	/*Req.doListenInitial(function(e, resp) {
		if (!e) {
			//sbm(resp, true)
			//todo:
			// keep an updated list of recently active pages
			//
		}
	})*/
	
	// update currently viewed page (in case page was hidden)
}

Req.onGuestLoad = function() {
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

Req.tryLoadCachedAuth()

if (document.readyState == 'loading')
	document.addEventListener('DOMContentLoaded', ready)
else
	ready()

function ready() {
	console.log("ONLOAD!")
	if (navigator.vendor=="Google Inc.") {
		console.info("chrome sucks")
		var x = document.createElement('style')
		x.textContent = "img, .iconBg { image-rendering: -webkit-optimize-contrast; }"
		document.head.appendChild(x)
	}
	
	View.onLoad()

	window.onerror = function(message, source, line, col, error) {
		try {
			Sidebar.print("Error: "+message+"\nin "+source+"\nat "+line+":"+col)
			// to prevent this from throwing more errors
			// though the scroll event might cause issues...
		} catch(e) {
			// yeah no
		}
	}

	Nav.initial()
}
