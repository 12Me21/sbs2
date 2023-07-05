'use strict'

// Use these to modify <textarea> contents without losing undo history
// Other safe operations are:
// - elem.select()
// - elem.setSelectionRange(start, end, dir)
// - document.execCommand(cmd, ?, data)
let Edit = NAMESPACE({
	clear(elem) {
		elem.select()
		document.execCommand('delete')
	},
	set(elem, text) {
		elem.select()
		if (text)
			document.execCommand('insertText', false, text)
		else
			document.execCommand('delete')
	},
	insert(elem, text) {
		elem.focus()
		document.execCommand('insertText', false, text)
	},
	exec(elem, command, ...args) {
		elem.focus()
		document.execCommand(command, false, ...args)
	}
})

// todo: namespace?
function switch_tab(next, no_focus) {
	if (!next || (next.hidden && !no_focus)) //hack
		return false
	let tablist = next.parentNode
	for (let tab of tablist.children) {
		let panel = document.getElementById(tab.getAttribute('aria-controls'))
		let current = tab===next
		tab.setAttribute('aria-selected', current)
		if (panel) {
			if (!current) {
				if (panel.onpause)
					panel.onpause(null) // todo: hack!
			}
			panel.classList.toggle('shown', current)
		}
		tab.tabIndex = current ? 0 : -1
	}
	if (!no_focus)
		next.focus()
}

document.addEventListener('focusout', e=>{
	let focused = e.target
	let new_focus = e.relatedTarget
	if (focused) {
		let role = focused.getAttribute('role')
		if ('tab'==role || 'row'==role || 'gridcell'==role || 'listitem'==role) {
			if (new_focus && new_focus.parentNode == focused.parentNode) {
				new_focus.tabIndex = 0
				focused.tabIndex = -1
			} else if ('gridcell'==role)
				focused.tabIndex = -1
		}
		let parent = focused.parentNode
		if (parent.dataset.ordered!=null) {
			if (!parent.contains(new_focus)) {
				// focus moving OUT of an ordered element
				parent.tabIndex = 0 // make it focusable again
				focused.tabIndex = -1
			}
		}
	}
	// focus moving into an ordered element
	if (new_focus && new_focus.dataset.ordered!=null) {
		// transfer focus to the first item instead
		new_focus.tabIndex=-1
		try_focus(order_first(new_focus))
		e.preventDefault() // is this right?
	}
})

function try_focus(elem) {
	elem && elem.focus()
}

function order_first(elem, dir=1) {
	let best = null
	let best_or = NaN
	for (let c of elem.children) {
		let or = +c.style.order*dir
		if (!(or > best_or)) {
			best = c
			best_or = or
		}
	}
	return best
}

function order_neighbor(elem, dir) {
	let order = +elem.style.order*dir
	let best = null
	let best_or = NaN
	for (let c of elem.parentNode.children) {
		let or = +c.style.order*dir
		if (or > order && !(or > best_or)) {
			best = c
			best_or = or
		}
	}
	if (best)
		return best
}
function get_neighbor(elem, dir) {
	if (elem.parentNode.dataset.ordered!=null)
		return order_neighbor(elem, dir)
	return dir<0 ? elem.previousElementSibling : elem.nextElementSibling
}

function focus_prev(elem) {
	try_focus(get_neighbor(elem, -1))
}
function focus_next(elem) { // function ({next: nextElementSibling}) {
	try_focus(get_neighbor(elem, 1))
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
			return
			// todo: pick the right ordered cell
			//try_focus(focused.querySelector(`[role="gridcell"]`))
		} else if ('ArrowUp'==e.key)
			focus_prev(focused)
		else if ('ArrowDown'==e.key)
			focus_next(focused)
		else
			return
	} else if ('listitem'==role) {
		if ('ArrowUp'==e.key)
			focus_prev(focused)
		else if ('ArrowDown'==e.key)
			focus_next(focused)
		else
			return
	} else
		return
	e.preventDefault()
})

// idea: for things like tab lists etc:
// set actual focus on the container/list element
// then arrows set the like, aria-activedescendant
