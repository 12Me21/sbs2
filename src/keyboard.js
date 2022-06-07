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
		tab.tabIndex = current ? 0 : -1
	}
	if (!no_focus)
		next.focus()
}

document.addEventListener('focusout', e=>{
	let focused = e.target
	let new_focus = e.relatedTarget
	if (!focused) return
	let role = focused.getAttribute('role')
	if ('tab'==role || 'row'==role || 'gridcell'==role) {
		if (new_focus && new_focus.parentNode == focused.parentNode) {
			new_focus.tabIndex = 0
			focused.tabIndex = -1
		} else if ('gridcell'==role)
			focused.tabIndex = -1
	}
})

function try_focus(elem) {
	elem && elem.focus()
}
function focus_prev(elem) {
	try_focus(elem.previousElementSibling)
}
function focus_next(elem) { // function ({next: nextElementSibling}) {
	try_focus(elem.nextElementSibling)
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
	} else if ('gridcell'==role) {
		if ('ArrowLeft'==e.key)
			focus_prev(focused)
		else if ('ArrowRight'==e.key)
			focus_next(focused)
		else
			return
	} else if ('row'==role) {
		if ('ArrowRight'==e.key) {
			try_focus(focused.querySelector(`[role="gridcell"]`))
		} else if ('ArrowUp'==e.key)
			focus_prev(focused)
		else if ('ArrowDown'==e.key)
			focus_next(focused)
		else
			return
	} else
		return
	e.preventDefault()
})
