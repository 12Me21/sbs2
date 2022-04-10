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
	console.log("🌅 STARTING INIT")
	Sidebar.print("hi!\ncommit: "+window.COMMIT)
	
	// (we can access <html> even if DOMContentLoaded hasn't occurred yet)
	// dark theme
	let dark = window.matchMedia("(prefers-color-scheme: dark)")
	dark.onchange = (query) => View.flag('dark', query.matches)
	dark.onchange(dark)
	
	Req.try_load_auth()
	
	if (!Req.auth) {
		console.warn("🌇 Not logged in!")
		return
	}
	//console.log("🌄 is logged in")
	View.flag('loggedIn', true)
	
	Settings.early()
	
	Lp.chain({values:{uid:Req.uid}, requests:[{type:'user',fields:'*',query:'id = @uid'}]}, resp=>{
		let me = resp.user[0]
		if (!me) {
			console.error(resp, 'me?"')
			throw "missing user me?"
		}
		console.log("🌄 Got own userdata")
		Req.me = me
		do_when_ready(()=> View.update_my_user(Req.me))
	})
	
	Lp.start_websocket()
	
	Act.pull_recent()
	
	if (window.location.hash=="" && window.location.search.length>1)
		Nav.replace_url(window.location.search.substr(1))
	
	window.onhashchange()
	
}

function dom_ready() {
	console.log("🌄 DOCUMENT READY")
	
	View.onload()
	
	Sidebar.onload()
	
	print("running "+run_on_load.length+" deferred items")
	do_when_ready = x=>x()
	run_on_load.forEach(x=>x())
	run_on_load = null
	
	//danger: View.onload() can potentially run after view.start() (but before view.render())  TODO
}
