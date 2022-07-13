'use strict'

// it would be nice to inject this earlier but 
let ls = Settings.values.html_inject
if ('string'==typeof ls)
	document.write(ls)

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
		do_when_ready(()=> View.update_my_user(Req.me))
	})
	
	StatusDisplay.global.set_status("active")
	
	Lp.start_websocket()
	
	Act.pull_recent()
	
	Nav.init()
	
}

function dom_ready() {
	console.log("🌄 DOCUMENT READY")
	
	View.$header = $titlePane
	
	print("running "+run_on_load.length+" deferred items")
	do_when_ready = x=>x()
	do_when_ready.then = null
	run_on_load.forEach(x=>x())
	run_on_load = null
	DEFER = x=>void x()
	//Object.defineProperty(ready, 'do', {set: fn=>fn()})
	
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
