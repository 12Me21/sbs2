window.onerror = (message, source, line, col, error)=>{
	console.log('window onerror')
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
	console.log("ONLOAD!")
	Req.tryLoadCachedAuth() // moved this here
	// does this still work
	if (navigator.vendor=="Google Inc.")
		document.documentElement.style.imageRendering = "-webkit-optimize-contrast"
	View.onLoad()
	
	Nav.initial()
}
