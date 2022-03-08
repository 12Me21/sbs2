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

immediate()

if (document.readyState == 'loading')
	document.addEventListener('DOMContentLoaded', dom_ready)
else
	dom_ready()

function immediate() {
	Req.try_load_cached_auth()
	Req.get_initial(()=>{
		console.log('Potentially got initial!')
	})
	
	Sidebar.print("hi!\ncommit: "+window.commit)
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

function dom_ready() {
	console.log("ONLOAD!")
	
	// whitespace between nodes in html (due to line breaks, indentation, etc.) creates text nodes which need to be stripped:
	let walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {acceptNode: node=>/^\s+$/.test(node.textContent)});
	let blank_nodes = []
	while (walker.nextNode())
		blank_nodes.push(walker.currentNode)
	// remove in 1 step rather than calling .remove() one at a time
	document.createElement('gay-baby-jail').append(...blank_nodes)
	console.log("removed "+blank_nodes.length+" blank text nodes")
	
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
	
	if (Req.auth)
		Req.on_login()
	else
		Req.on_guest_load()
	
	View.init()
	
	Sidebar.init()
	
	Nav.initial()
}
