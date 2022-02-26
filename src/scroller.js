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
		item.callback(item.size) // old size?
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

let track_scroll_resize = new ResizeTracker('height')

class Scroller {
	constructor(outer, inner) { // constructor todo. take outer element only. create inner element here.
		this.outer = outer
		this.inner = inner
		
		this.middle = document.createElement('scroll-middle')
		this.middle.append(this.inner)
		
		this.outer.append(this.middle)
		
		this.anim_id = null
		this.anim_pos = 0
		
		this.rate = 0.25 //autoscroll rate: amount of remaining distance to scroll per 1/60 second
		this.bottom_region = 0.25 //if within this distance of bottom, autoscroll is enabled
		
		//outer.addEventListener('scroll', (e)=>{
		//}, {passive: true})
		
		track_scroll_resize.add(this.outer, (old_size)=>{
			if (this.at_bottom(old_size, undefined))
				this.scroll_instant()
		})
		track_scroll_resize.add(this.inner, (old_size)=>{
			if (this.at_bottom(undefined, old_size))
				this.scroll_instant()
		})
		
		Object.seal(this)
	}
	scroll_height() {
		return this.inner.getBoundingClientRect().height
	}
	at_bottom(outer_height = this.outer.clientHeight, scroll_height = this.outer.scrollHeight) {
		return scroll_height-outer_height-this.outer.scrollTop < 10//outer_height*this.bottom_region
	}
	scroll_instant() {
		this.outer.scrollTop = 9e9
	}
	print(callback, animate) {
		let at_bottom = this.at_bottom()
		// skip height calculation unless needed
		let height1 = (at_bottom && animate) ? this.scroll_height() : null
		
		try {
			let elem = callback()
			elem && this.inner.append(elem)
		} finally {
			if (at_bottom) {
				this.scroll_instant()
				if (animate) {
					let diff = this.scroll_height() - height1
					this.start_animation(diff)
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
		let height1 = this.scroll_height()
		let scroll = this.outer.scrollTop
		
		try {
			let elem = callback()
			elem && this.inner.prepend(elem)
		} finally {
			// problem: the resize detection gets triggered here, I think
			// and.. idk it causes you to jump downwards sometimes if I set the scrollTop here
			
			//let diff = this.scroll_height()-height1
			//this.outer.scrollTop = scroll + diff
		}
	}
	destroy() {
		track_scroll_resize.remove(this.inner)
		track_scroll_resize.remove(this.outer)
	}
}



// todo: we only want to animate if an element is inserted/removed/resized at the BOTTOM of the screen. but how to detect this? probably best, I suppose, if the chat room handles it?

// idea:

// imagine a message is inserted/deleted/edited in the MIDDLE of the visible area
// you want to only shift the content above it, not everything
// but how on earth would this even be implemented...

// could do something like
// have a list of all modified elements
// measure their heights before/after
// animate the height changes of those elements by setting their style.height
