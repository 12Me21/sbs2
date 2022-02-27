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

let dark = window.matchMedia("(prefers-color-scheme: dark)")
dark.onchange = (query)=>{
	View.flag('dark', query.matches)
}
dark.onchange(dark)

Sidebar.print("hi!\ncommit: "+window.commit)

if (document.readyState == 'loading')
	document.addEventListener('DOMContentLoaded', ready)
else
	ready()
function ready() {
	// whitespace between nodes in html (due to line breaks, indentation, etc.) creates text nodes which need to be stripped:
	let walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {acceptNode: node=>/^\s+$/.test(node.textContent)});
	let blank_nodes = []
	while (walker.nextNode())
		blank_nodes.push(walker.currentNode)
	document.createElement('gay-baby-jail').append(...blank_nodes)
	console.log("removed "+blank_nodes.length+" blank text nodes")
	//hit_list.forEach(node=>node.remove())
	
	// draw links
	document.querySelectorAll("a[data-static-path]").forEach((elem)=>{
		Nav.link(elem.dataset.staticPath, elem)
	})
	// draw buttons
	// i really don't like this
	document.querySelectorAll("button:not([data-noreplace])").forEach((button)=>{
		let container = document.createElement("div")
		container.className = "buttonContainer"
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
	
	console.log("ONLOAD!")
	Req.try_load_cached_auth() // moved this here
	// does this still work
	if (navigator.vendor=="Google Inc.")
		document.documentElement.style.imageRendering = "-webkit-optimize-contrast"
	View.init()
	
	Nav.initial()
}
