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
	Req.onMessages = function(comments) {
		ChatRoom.displayMessages(comments)
		Entity.updateAggregateComments(Req.currentActivity, comments)
		Sidebar.onAggregateChange(Req.currentActivity)
	}
	Req.onListeners = function(a) {
		ChatRoom.updateUserLists(a)
	}
	Req.onActivity = function(a) {
		a.forEach(function(a) {
			if (a.type == 'user')
				View.updateUserAvatar(a.content)
		})
		Entity.updateAggregateActivity(Req.currentActivity, a)
		Sidebar.onAggregateChange(Req.currentActivity) //this might update unnecessarily often
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

	Req.getRecentActivity(function(a, c, p) {
		Entity.updateAggregateActivity(Req.currentActivity, a, p)
		Entity.updateAggregateCommentAggregate(Req.currentActivity, c, p)
		Sidebar.onAggregateChange(Req.currentActivity)
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
		//console.info("chrome sucks")
		document.documentElement.style.imageRendering="-webkit-optimize-contrast"
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
