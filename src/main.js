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
delete window.sidebar // obsolete firefox global variable

Req.onLogin = ()=>{
	console.log("login")
	View.flag('loggedIn', true)
	
	// display user info etc.
	// start long poller
	Lp.onMessages = (comments, contents)=>{
		ChatRoom.displayMessages(comments)
		Act.newComments(comments, Entity.makePageMap(contents))
		Sidebar.onAggregateChange(Act.items)
		Sidebar.displayMessages(comments)
	}
	Lp.onListeners = (a)=>{
		ChatRoom.updateUserLists(a)
	}
	Lp.onActivity = (a, p)=>{ //todo: properly link activity with contents?
		a.forEach(a=>{
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
	if (Store.get('websocket'))
		Lp.use_websocket = true
	Lp.onStart = (e, resp)=>{
		print("got initial lp response!")
		if (!e) {
			let me = resp.chains.Ume
			console.log("me", resp, me)
			if (me && me[0])
				View.updateMyUser(me[0]) //also sets Req.me...
		} else {
			alert("INITIAL LONG POLL FAILED!")
		}
	}
	Lp.start()
	
	Act.pullRecent()
	
	//TODO
	// update currently viewed page (in case page was hidden)
}

Entity.onCategoryUpdate = (cats)=>{
	Sidebar.redrawCategoryTree(cats)
}

Req.onGuestLoad = ()=>{
	Act.pullRecent()
}

Req.onLogout = ()=>{
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
