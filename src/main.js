'use strict'

// it would be nice to inject this earlier but 
let ls = Settings.values.html_inject
if ('string'==typeof ls) {
	document.write(ls)
	//note: see https://html.spec.whatwg.org/multipage/dynamic-markup-insertion.html#document-write-steps
}

document.addEventListener('DOMContentLoaded', dom_ready)
immediate()

function immediate() {
	console.log("🌅 STARTING INIT")
	Sidebar.print("hi!\ncommit: "+window.COMMIT)
	
	try {
		undefined = 2
		console.warn("'use strict' not enabled!") // todo: warn/error printing ? higher priority? (pin to bottom?)
		do_when_ready(x=>print("⚠️ 'use strict' not enabled!"))
	} catch (e) {}
	
	Req.try_load_auth()
	
	if (!Req.auth) {
		console.warn("🌇 Not logged in!")
		return
	}
	document.documentElement.dataset.login = ""
	
	Settings.init()
	
	Lp.init()
	
	// get own user
	Lp.chain({
		values: {uid:Req.uid},
		requests: [{type:'user', fields:'*', query:"id = @uid"}],
	}, resp=>{
		let me = resp.user[0]
		if (!me) {
			console.error(resp, 'me?"')
			throw "missing user me?"
		}
		console.log("🌄 Got own userdata")
		Req.me = me
		do_when_ready(()=> Sidebar.redraw_my_avatar())
	})
	
	Lp.set_status(0, 'active')
	
	Lp.start_websocket()
	
	Act.pull_recent()
	
	Nav.start()
}

function dom_ready() {
	console.log("🌄 DOCUMENT READY")
	
	//View.$header = $titlePane
	
	print("running "+run_on_load.length+" deferred items")
	do_when_ready = x=>{x()}
	do_when_ready.then = null
	run_on_load.forEach(x=>x())
	run_on_load = null
	//Object.defineProperty(ready, 'do', {set: fn=>fn()})
	// idea: do_when_ready takes a 2nd argument, which creates a "pool" of events,
	// and only the most recently added one is run
	
	//danger: View.onload() can potentially run after view.start() (but before view.render())  TODO
	window.onerror = function(message, source, line, col, error) {
		let ok
		try {
			// syntax errors may be "muted" for security reasons
			// in that case, create a fake error with the info we have
			// (generally, that's only the filename)
			if (!error) {
				error = new Error(message)
				error.stack = "@"+source+":"+line+":"+col
			}
			Sidebar.print(error)
			ok = true
		} finally {
			if (!ok)
				alert("error while handling error!")
		}
	}
}
