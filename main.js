Sidebar.print("hi!")
delete window.sidebar // obsolete firefox global variable

/*window.onerror = function(message, source, line, col, error) {
	console.log("e")
}*/

Req.onLogin = function() {
	console.log("login")
	View.flag('loggedIn', true)

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
	Req.onActivity = function(a, p) { //todo: properly link activity with contents?
		a.forEach(function(a) {
			if (a.type == 'user')
				View.updateUserAvatar(a.content)
		})
		Entity.updateAggregateActivity(Req.currentActivity, a, p)
		Sidebar.onAggregateChange(Req.currentActivity) //this might update unnecessarily often
	}
	
	console.log("staring long poller")
	// it's very important that the first long poll request finishes instantly
	// we normally ensure this by having lpLastListeners always have at least one room set but this can be accidentally broken very easily and it's a mess
	// need a more consistent way to update lastlisteners PLEASE
	Req.lpStart(function(e, resp) {
		if (!e) {
			var me = resp.chains.Ume
			if (me && me[0])
				View.updateMyUser(me[0]) //also sets Req.me...
		} else {
			alert("INITIAL LONG POLL FAILED!")
		}
	})

	Req.getRecentActivity(function(a, c, wa, wc, p) {
		Entity.updateAggregateActivity(Req.currentActivity, a, p)
		Entity.updateAggregateCommentAggregate(Req.currentActivity, c, p)
		Entity.updateAggregateActivity(Req.watchingActivity, wa, p)
		Entity.updateAggregateCommentAggregate(Req.watchingActivity, wc, p)
		Sidebar.onAggregateChange(Req.currentActivity)
		Sidebar.onWatchingChange(Req.watchingActivity)
	})

	//TODO
	// update currently viewed page (in case page was hidden)
}

Req.onGuestLoad = function() {
	Req.getRecentActivity(function(a, c, wa, wc, p) {
		Entity.updateAggregateActivity(Req.currentActivity, a, p)
		Entity.updateAggregateCommentAggregate(Req.currentActivity, c, p)
		Entity.updateAggregateActivity(Req.watchingActivity, wa, p)
		Entity.updateAggregateCommentAggregate(Req.watchingActivity, wc, p)
		Sidebar.onAggregateChange(Req.currentActivity)
		Sidebar.onWatchingChange(Req.watchingActivity)
	})
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
