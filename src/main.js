window.onerror = function(message, source, line, col, error) {
	try {
		// sometimes we don't get any useful information other than the filename
		if (error)
			Sidebar.print(error.stack)
		if (line)
			Sidebar.print(`ERROR: ${message}\nin ${source}\nat ${line}:${col}`)
		else
			Sidebar.print(`ERROR: ${message}\nin ${source}`)
	} catch(e) {
		console.error("error in window.onerror:", e, arguments)
		// yeah no
	}
}

window.onunhandledrejection = function(event) {
	try {
		Sidebar.print("ERROR IN PROMISE: ", event.reason)
	} catch(e) {
		console.error("error in window.onunhandledrejection:", e, event)
	}
}

window.onbeforeunload = (event)=>{
	// this is to prevent the websocket.onclose event
	// from trying to reopen it
	Lp.dead = true
}

immediate()

if (document.readyState == 'loading')
	document.addEventListener('DOMContentLoaded', dom_ready)
else
	dom_ready()

function immediate() {
	Sidebar.print("hi!\ncommit: "+window.commit)
	
	Req.try_load_auth()
	
	if (Req.auth) {
		console.log("🌄 got auth")
		View.flag('loggedIn', true)
		
		Settings.early()
		new (Req.get_me())(me=>{
			Req.me = me
			do_when_ready(()=> View.update_my_user(me))
		})
		
		Lp.start_websocket()
		Nav.initial()
		
		//Act.pull_recent()
		//Lp.start()
	} else {
		console.warn("🌄 Not logged in!")
		Nav.initial()
		//Act.pull_recent()
		
	}
	
	// we can access this even if DOMContentLoaded hasn't occurred yet
	let root = document.documentElement
	// dark theme
	let dark = window.matchMedia("(prefers-color-scheme: dark)")
	dark.onchange = (query)=>{
		root.classList.toggle('f-dark', query.matches)
	}
	dark.onchange(dark)
	// detect chromium browsers (broken image downscaling)
	if (navigator.vendor=="Google Inc.")
		root.style.imageRendering = "-webkit-optimize-contrast"
}

function got_initial({lastid, me}) {
	console.log("🌄 got initial, staring long poller etc.")
	//Lp.update_lastid(lastid)
	//Lp.start()
	Nav.initial()
	Act.pull_recent() // TODO: I'd like to run this before lastid
	// we can do this probably, AS LONG AS
	// maybe we decrement lastid by like 10 or something just in case
}

function dom_ready() {
	console.log("🌄 DOM ready")
	
	// draw links
	for (let elem of document.querySelectorAll("a[data-static-path]")) {
		Nav.link(elem.dataset.staticPath, elem)
	}
	// draw buttons
	// i really don't like this
	for (let button of document.querySelectorAll("button:not([data-noreplace])")) {
		let container = document.createElement('button-container')
		button.replaceWith(container)
		container.className += " "+button.className
		button.className = ""
		if (button.dataset.staticLink != undefined) {
			button.setAttribute('tabindex', "-1")
			let a = document.createElement('a')
			container.append(a)
			container = a
		}
		container.append(button)
	}
	
	View.onload()
	
	Sidebar.onload()
	
	print("running "+run_on_load.length+" deferred items")
	init_done = true
	for (let f of run_on_load)
		f()
	run_on_load = null
	
	//danger: view.init() can potentially run after view.start() (but before view.render())
}
