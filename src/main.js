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
	let hit_list = []
	while (walker.nextNode())
		hit_list.push(walker.currentNode)
	console.log("removed "+hit_list.length+" blank text nodes")
	hit_list.forEach(node=>node.remove())
	
	console.log("ONLOAD!")
	Req.try_load_cached_auth() // moved this here
	// does this still work
	if (navigator.vendor=="Google Inc.")
		document.documentElement.style.imageRendering = "-webkit-optimize-contrast"
	View.init()
	
	Nav.initial()
}
