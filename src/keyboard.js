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

function switch_cell(next) {
	if (!next)
		return
	for (let item of next.parentNode.children) {
		let current = item===next
		item.setAttribute('aria-selected', current)
		if (current)
			item.removeAttribute('tabindex')
		else
			item.setAttribute('tabindex', -1)
	}
	next.focus()
}

function switch_row(next) {
	if (!next)
		return
	for (let item of next.parentNode.children) {
		let current = item===next
		item.setAttribute('aria-selected', current)
		if (current)
			item.removeAttribute('tabindex')
		else
			item.setAttribute('tabindex', -1)
	}
	next.focus()
}

// todo: really we just need to keep track of which elements have "temporary" focus and like. idk
document.addEventListener('focusout', e=>{
	let focused = e.target
	if (!focused) return
	let role = focused.getAttribute('role')
	if ('gridcell'==role) {
		focused.setAttribute('tabindex', -1)
	} else if ('row'==role) {
		let parent = focused.parentElement
		if (!parent.contains(document.activeElement)) {
			focused.setAttribute('tabindex', -1)
			parent.firstElementChild.setAttribute('tabindex', 0)
		}
	}
		return
})

/*document.addEventListener('focusin', e=>{
	let focused = document.activeElement
	if (!focused) return
	let role = focused.getAttribute('role')
	if ('row'==role) {
		let ti = focused.querySelector(`[role="gridcell"][tabindex="0"]`)
		if (!ti) return
		ti.setAttribute('tabindex', -1)
	} else
		return
})*/

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
			switch_cell(focused.previousElementSibling)
		else if ('ArrowRight'==e.key)
			switch_cell(focused.nextElementSibling)
		else
			return
	} else if ('row'==role) {
		if ('ArrowRight'==e.key)
			switch_cell(focused.querySelector(`[role="gridcell"]`))
		else if ('ArrowUp'==e.key)
			switch_row(focused.previousElementSibling)
		else if ('ArrowDown'==e.key)
			switch_row(focused.nextElementSibling)
		else
			return
	} else
		return
	e.preventDefault()
})
