function switch_tab(next, no_focus) {
	if (!next)
		return
	let tablist = next.parentNode
	for (let tab of tablist.children) {
		let panel = document.getElementById(tab.getAttribute('aria-controls'))
		let current = tab===next
		tab.setAttribute('aria-selected', current)
		if (panel)
			panel.classList.toggle('shown', current)
		if (current)
			tab.removeAttribute('tabindex')
		else
			tab.setAttribute('tabindex', -1)
	}
	
	if (!no_focus)
		next.focus()
}

document.addEventListener('keydown', e=>{
	let focused = document.activeElement
	if (!focused) return
	let role = focused.getAttribute('role')
	if ('tab'==role) {
		if ('ArrowLeft'==e.key)
			switch_tab(focused.previousElementSibling)
		else if ('ArrowRight'==e.key)
			switch_tab(focused.nextElementSibling)
		else
			return
	} else
		return
	e.preventDefault()
})
