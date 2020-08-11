Req.onLogin = function() {
	// display user info etc.
	// start long poller
	// update currently viewed page (in case page was hidden)
}

Req.onLogout = function() {
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
}
