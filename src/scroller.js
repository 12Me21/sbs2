//let track_scroll_resize = new ResizeTracker('height')

// todo:
// if not at bottom, we need to adjust the scroll position backwards
// upon resize of the inner element

// we could use the scrolltop max trick here again...
// alternatively:
// *switch the scroller direction depending on whether the user is near the bottom*
// hmmm

class Scroller {
	constructor(outer, inner) { // constructor todo. take outer element only. create inner element here.
		this.outer = outer
		this.outer.classList.add('bottom')
		this.inner = inner
		
		this.rate = 0.25 //autoscroll rate: amount of remaining distance to scroll per 1/60 second
		this.bottom_height = 0.25 //if within this distance of bottom, autoscroll is enabled
		
		outer.addEventListener('scroll', (e)=>{
			this.cancel_scroll()
		}, {passive: true})
		
		Object.seal(this)
	}
	scroll_height() {
		return this.inner.getBoundingClientRect().height
	}
	get scrollBottom() {
		return -this.outer.scrollTop
	}
	set scrollBottom(value) {
		this.outer.scrollTop = -value
	}
	scroll_instant() {
		this.cancel_scroll()
		this.scrollBottom = -3
	}
	at_bottom() {
		return this.scrollBottom < this.outer.clientHeight*this.bottom_height
		//return this.scrollBottom <3
	}
	autoscroll() {
		this.scrollBottom = -3
		// todo: 
	}
	cancel_scroll() {
		// todo: 
	}
	//if you want to insert an element into the scroller, do something like:
	// scroller.print(function() {
	//    return document.createElement('div')
	// }, true) // (or `false` to disable scrolling (for example, when inserting the initial elements, you might disable scrolling here and then run scroller.autoScroll(true) afterwards, to scroll to the bottom instantly)
	//(the reason it's inside a function is because it needs to run code
	// before AND after inserting the element)
	
	print(callback, autoscroll) {
		let at_bottom = this.at_bottom()
		let height1
		if (!at_bottom)
			height1 = this.scroll_height()
		
		try {
			let elem = callback()
			elem && this.inner.append(elem)
		} finally {
			if (at_bottom) {
				if (autoscroll)
					this.autoscroll()
			} else {
				let height2 = this.scroll_height()
				let diff = height2 - height1
				this.scrollBottom = this.scrollBottom + ydiff
			}
		}
	}
	print_top(callback) {
		let elem = callback()
		elem && this.inner.prepend(elem)
	}
	destroy() {
	}
}


class ResizeTracker {
	constructor(measure) {
		this.measure = measure
		// ResizeObserver is a very new feature (added in ~2020)
		if (window.ResizeObserver) {
			this.tracking = new WeakMap()
			this.observer = new ResizeObserver((events)=>{
				events.forEach((event)=>{
					this.check_element(
						this.tracking.get(event.target),
						event.contentRect,
					)
				})
			})
		} else {
			this.tracking = []
			this.interval = window.setInterval(()=>{
				this.tracking.forEach((item)=>{
					this.check_element(
						item,
						item.element.getBoundingClientRect(),
					)
				})
			}, 200)
		}
		Object.seal(this)
	}
	check_element(item, rect) {
		if (!item) return
		if (!rect.width) return //ignore changes for hidden elements
		if (rect[this.measure] == item.size) return //need to check if height changed in case of an ignored hide/show cycle
		item.callback()
		item.size = rect[this.measure]
	}
	add(element, callback) {
		let n = {
			element: element,
			callback: callback,
			size: element.getBoundingClientRect()[this.measure],
		}
		if (this.observer) {
			this.observer.observe(element)
			this.tracking.set(element, n)
		} else {
			this.tracking.push(n)
		}
	}
	remove(element) {
		if (this.observer) {
			this.observer.unobserve(element)
			this.tracking.delete(element)
		} else {
			let i = this.tracking.findIndex(x => x.element == element)
			i>=0 && this.tracking.splice(i, 1)
		}
	}
}

		
