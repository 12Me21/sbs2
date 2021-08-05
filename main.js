window.onerror = function(message, source, line, col, error) {
	try {
		console.error(arguments)
		if (!error)
			return
		Sidebar.print("Error: "+message+"\nin "+source+"\nat "+line+":"+col)
		// to prevent this from throwing more errors
		// though the scroll event might cause issues...
	} catch(e) {
		// yeah no
	}
}

if (window.matchMedia("(prefers-color-scheme: dark)").matches)
	document.documentElement.dataset.dark = ""

Sidebar.print("hi!\ncommit: "+window.commit)
delete window.sidebar // obsolete firefox global variable

Req.onLogin = function() {
	console.log("login")
	View.flag('loggedIn', true)
	
	// display user info etc.
	// start long poller
	Req.onMessages = function(comments, contents) {
		ChatRoom.displayMessages(comments)
		Act.newComments(comments, Entity.makePageMap(contents))
		Sidebar.onAggregateChange(Act.items)
		Sidebar.displayMessages(comments)
	}
	Req.onListeners = function(a) {
		ChatRoom.updateUserLists(a)
	}
	Req.onActivity = function(a, p) { //todo: properly link activity with contents?
		a.forEach(function(a) {
			if (a.type == 'user')
				View.updateUserAvatar(a.content) //todo: also update your avatar in sidebar
		})
		Act.newActivity(a, Entity.makePageMap(p))
		Sidebar.onAggregateChange(Act.items) //this might update unnecessarily often
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
	
	Act.pullRecent()
	
	//TODO
	// update currently viewed page (in case page was hidden)
}

Entity.onCategoryUpdate = function(cats) {
	Sidebar.redrawCategoryTree(cats)
}

Req.onGuestLoad = function() {
	Act.pullRecent()
}

Req.onLogout = function() {
	View.flag('loggedIn', false)
	//this is all messy
	window.location.reload()
}

Req.tryLoadCachedAuth()

if (document.readyState == 'loading')
	document.addEventListener('DOMContentLoaded', ready)
else
	ready()

function ready() {
	console.log("ONLOAD!")
	if (navigator.vendor=="Google Inc.")
		document.documentElement.style.imageRendering = "-webkit-optimize-contrast"
	//can't remember if this is still needed
	//document.documentElement.addEventListener('touchstart', function(e) {
	//	e.preventDefault()
	//})
	View.onLoad()
	
	Nav.initial()
}
