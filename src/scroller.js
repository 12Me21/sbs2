//let track_scroll_resize = new ResizeTracker('height')

// todo:
// if not at bottom, we need to adjust the scroll position backwards
// upon resize of the inner element

// we could use the scrolltop max trick here again...

class Scroller {
	constructor(outer, inner) { // constructor todo. take outer element only. create inner element here.
		this.outer = outer
		this.outer.classList.add('bottom')
		this.inner = inner
		
		this.anim_id = null
		this.anim_pos = 0
		
		this.rate = 0.25 //autoscroll rate: amount of remaining distance to scroll per 1/60 second
		this.bottom_height = 0.25 //if within this distance of bottom, autoscroll is enabled
		
		outer.addEventListener('scroll', (e)=>{
			//
		}, {passive: true})
		
		Object.seal(this)
	}
	scroll_height() {
		return this.inner.getBoundingClientRect().height
	}
	scroll_instant() {
		this.cancel_animation()
		this.outer.scrollTop = 3
	}
	at_bottom() {
		return -this.outer.scrollTop < this.outer.clientHeight*this.bottom_height
	}
	//if you want to insert an element into the scroller, do something like:
	// scroller.print(function() {
	//    return document.createElement('div')
	// }, true) // (or `false` to disable scrolling (for example, when inserting the initial elements, you might disable scrolling here and then run scroller.autoScroll(true) afterwards, to scroll to the bottom instantly)
	//(the reason it's inside a function is because it needs to run code
	// before AND after inserting the element)
	
	print(callback, animate) {
		let at_bottom = this.at_bottom()
		// skip height calculation in simplest case
		let height1 = (at_bottom && !animate) ? null : this.scroll_height()
		
		try {
			let elem = callback()
			elem && this.inner.append(elem)
		} finally {
			if (at_bottom && !animate) { // simplest case
				this.scroll_instant()
			} else { // otherwise we need to calculate new height
				let height2 = this.scroll_height()
				let diff = height2 - height1
				if (at_bottom) {
					this.start_animation(diff)
				} else {
					// adjust scroll position so contents don't jump when you're not at the bottom
					this.outer.scrollTop -= diff
				}
			}
		}
	}
	start_animation(dist) {
		window.cancelAnimationFrame(this.anim_id)
		this.anim_id = null
		this.animate_insertion(this.anim_pos + dist)
	}
	cancel_animation() {
		if (this.anim_id != null) {
			window.cancelAnimationFrame(this.anim_id)
			this.end_animation()
		}
	}
	end_animation() {
		this.anim_id = null
		this.anim_pos = 0
		this.inner.style.transform = ""
	}
	animate_insertion(dist, prev_time = performance.now()) {
		// abs allows animation to play backwards (for deleting comments)
		if (Math.abs(dist) <= 1) {
			this.end_animation()
			return
		}
		this.inner.style.transform = `translate(0, ${dist}px)`
		this.anim_pos = dist
		let id = window.requestAnimationFrame((time)=>{
			// the argument passed by animationframe is wrong in Chromium browsers
			time = performance.now()
			// if the animation was cancelled or another was started
			if (this.anim_id != id)
				return 
			// delta time adjusted version of
			// new_dist = dist * (1-this.rate) @ 60fps
			let dt = Math.min((time-prev_time) / (1000/60), 2)
			let new_dist = dist * Math.pow(1-this.rate, dt)
			this.animate_insertion(new_dist, time)
		})
		this.anim_id = id
	}
	// todo: this should be used instead of print() if you're making changes
	// to elements above the current scroll position
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

		
