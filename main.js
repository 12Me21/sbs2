/*window.onerror = function(message, source, line, col, error) {
	console.log("e")
}*/

//if (navigator.vendor=="Google Inc.")
console.log(window.document.styleSheets)

Req.onLogin = function() {
	View.flag('loggedIn', true)
	Req.getMe(function(user) {
		$loggedIn.replaceChildren(Draw.entityTitleLink(user, true))
	})
	// display user info etc.
	// start long poller
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
	Req.tryLoadCachedAuth()
	
	Nav.initial()

	View.onLoad()
}
