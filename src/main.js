window.onerror = (message, source, line, col, error)=>{
	try {
		console.error(arguments)
		if (!error)
			return
		Sidebar.print(`Error: ${message}
in ${source}
at ${line}:${col}`)
		// to prevent this from throwing more errors
		// though the scroll event might cause issues...
	} catch(e) {
		// yeah no
	}
}

let dark = window.matchMedia("(prefers-color-scheme: dark)")
dark.onchange = (query)=>{
	View.flag('dark', query.matches)
}
dark.onchange(dark)

Sidebar.print("hi!\ncommit: "+window.commit)

Req.on_login = function() {
	console.log("login")
	View.flag('loggedIn', true)
	
	// display user info etc.
	// start long poller
	
	console.log("staring long poller")
	// it's very important that the first long poll request finishes instantly
	// we normally ensure this by having lpLastListeners always have at least one room set but this can be accidentally broken very easily and it's a mess
	// need a more consistent way to update lastlisteners PLEASE
	if (Store.get('websocket'))
		Lp.start(false)
	else
		Lp.start(false)
	
	Act.pullRecent()
	
	//TODO
	// update currently viewed page (in case page was hidden)
}

Entity.onCategoryUpdate = (cats)=>{
	Sidebar.redrawCategoryTree(cats)
}

Req.on_guest_load = function(){
	Act.pullRecent()
}

Req.on_logout = function() {
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
	// does this still work
	if (navigator.vendor=="Google Inc.")
		document.documentElement.style.imageRendering = "-webkit-optimize-contrast"
	View.onLoad()
	
	Nav.initial()
}
