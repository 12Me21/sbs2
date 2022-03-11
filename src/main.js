window.onerror = function(message, source, line, col, error) {
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
		// idk if i like this...
		Req.get_initial().then(({systemaggregate, Ume})=>{
			let lastid = systemaggregate.find(x=>x.type=='actionMax').id
			let me = Ume[0]
			if (!me || me.id != Req.uid)
				throw 'invalid own user'
			return {lastid, me}
		}).then(got_initial, (e, resp)=>{
			alert("INITIAL DATA FAILED!")
		})
		
		if (Store.get('websocket'))
			Lp.use_websocket = true
		else
			Lp.use_websocket = false
		Lp.do_early()
	} else {
		console.warn("🌄 Not logged in!")
		Nav.initial()
		Act.pull_recent()
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
	Req.me = me
	View.do_when_ready(()=> View.update_my_user(me) )
	Lp.update_lastid(lastid)
	Lp.start()
	Nav.initial()
	Act.pull_recent() // TODO: I'd like to run this before lastid
	// we can do this probably, AS LONG AS
	// maybe we decrement lastid by like 10 or something just in case
}

function dom_ready() {
	console.log("🌄 DOM ready")
	
	// whitespace between nodes in html (due to line breaks, indentation, etc.) creates text nodes which need to be stripped:
	let walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {acceptNode: node=>/^\s+$/.test(node.textContent)});
	let blank_nodes = []
	while (walker.nextNode())
		blank_nodes.push(walker.currentNode)
	// remove in 1 step rather than calling .remove() one at a time
	document.createElement('gay-baby-jail').append(...blank_nodes)
	//console.log("removed "+blank_nodes.length+" blank text nodes")
	
	// draw links
	document.querySelectorAll("a[data-static-path]").forEach((elem)=>{
		Nav.link(elem.dataset.staticPath, elem)
	})
	// draw buttons
	// i really don't like this
	document.querySelectorAll("button:not([data-noreplace])").forEach((button)=>{
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
	})
	
	View.onload()
	
	Sidebar.onload()
	
	// do these ever really happen?
	print("running "+View.run_on_load.length+" deferred items")
	View.init_done = true
	for (let f of View.run_on_load)
		f()
	View.run_on_load = null
	
}
