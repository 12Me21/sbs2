'use strict'
let ResizeTracker
// ResizeObserver is a very new feature (added in ~2020)
if (window.ResizeObserver) {
	ResizeTracker = class {
		constructor(measure) {
			this.measure = measure
			this.tracking = new WeakMap()
			this.observer = new ResizeObserver(events=>{
				for (let event of events) {
					let item = this.tracking.get(event.target)
					let rect = event.contentRect
					//ignore changes for hidden and unchanged elements
					if (rect.width && rect[this.measure]!=item.size) {
						item.callback(item.size) // pass old size
						item.size = rect[this.measure]
					}
				}
			})
			Object.seal(this)
		}
		add(element, callback) {
			this.observer.observe(element)
			this.tracking.set(element, {
				callback: callback,
				size: element.getBoundingClientRect()[this.measure],
			})
		}
		remove(element) {
			this.observer.unobserve(element)
			this.tracking.delete(element)
		}
	}
} else {
	ResizeTracker = class {
		constructor(measure) {
			this.measure = measure
			this.tracking = []
			this.interval = window.setInterval(()=>{
				for (let item of this.tracking) {
					let rect = item.element.getBoundingClientRect()
					if (rect.width && rect[this.measure]!=item.size) {
						item.callback(item.size)
						item.size = rect[this.measure]
					}
				}
			}, 200)
			Object.seal(this)
		}
		add(element, callback) {
			this.tracking.push({
				element: element,
				callback: callback,
				size: element.getBoundingClientRect()[this.measure],
			})
		}
		remove(element) {
			let i = this.tracking.findIndex(x => x.element == element)
			i>=0 && this.tracking.splice(i, 1)
		}
	}
}



class Scroller {
	constructor(outer, inner) { // constructor todo. take outer element only. create inner element here.
		this.outer = outer
		this.inner = inner
		
		this.middle = document.createElement('scroll-middle')
		this.middle.append(this.inner)
		this.outer.append(this.middle)
		
		this.anim_type = Scroller.anim_type
		this.anim_id = null
		this.anim_pos = 0
		if (this.anim_type==2)
			this.inner.classList.add('scroll-anim3')
		
		// amount of remaining distance to scroll per 1/60 second
		this.rate = 0.25
		// autoscroll is enabled within this distance from the bottom
		this.bottom_region = 10
		
		Scroller.track_height.add(this.outer, (old_size)=>{
			if (this.at_bottom(old_size, undefined))
				this.scroll_instant()
		})
		Scroller.track_height.add(this.inner, (old_size)=>{
			if (this.at_bottom(undefined, old_size))
				this.scroll_instant()
		})
		
		Object.seal(this)
	}
	scroll_height() {
		return this.inner.getBoundingClientRect().height
	}
	at_bottom(outer_height = this.outer.clientHeight, scroll_height = this.outer.scrollHeight) {
		return scroll_height-outer_height-this.outer.scrollTop < this.bottom_region
	}
	scroll_instant() {
		this.outer.scrollTop = 9e9
	}
	before_print(animate) {
		if (this.at_bottom())
			// only calculate height if we need it for the animation
			return animate ? this.scroll_height() : true
		return false
	}
	after_print(before) {
		if (before === false)
			return // not at bottom
		this.scroll_instant()
		if (before === true) {
			this.cancel_animation()
			return // no animation
		}
		let diff = this.scroll_height() - before
		this.start_animation(diff)
	}
	// todo: instead of these print wrappers, what if we just
	// used mutation observers to detect stuff being added/removed
	// or, looked at the height change events?
	print(callback, animate) {
		let height = this.before_print(animate)
		try {
			callback()
		} finally {
			this.after_print(height)
		}
	}
	set_shift(y) {
		this.inner.style.transform = y ? `translateY(${y}px)` : ""
	}
	start_animation(dist) {
		if (Math.abs(dist) <= 1)
			return
		if (this.anim_type==2) {
			this.anim_id = true
			//let d = parseFloat(getComputedStyle(this.inner).top)
			this.inner.style.transition = "initial"
			this.set_shift(dist)
			void this.inner.offsetWidth
			this.inner.style.transition = ""
			this.set_shift(0)
		} else if (this.anim_type==1) {
			window.cancelAnimationFrame(this.anim_id)
			this.anim_id = null
			this.animate_insertion(this.anim_pos + dist)
		}
	}
	cancel_animation() {
		if (!this.anim_id)
			return
		if (this.anim_type==2) {
			this.inner.style.transition = "initial"
			// need to set transform to a /different/ value than before
			// otherwise it won't cancel the transition...
			this.inner.style.transform = "translateY(0)"
			this.anim_id = null
		} else if (this.anim_type==1) {
			window.cancelAnimationFrame(this.anim_id)
			this.end_animation()
		}
	}
	// only for anim_type 1:
	end_animation() {
		this.anim_id = null
		this.anim_pos = 0
		this.set_shift(0)
		//this.inner.style.transform = `translateY(0px)`
	}
	animate_insertion(dist, prev_time = document.timeline.currentTime) {
		this.set_shift(dist)
		this.anim_pos = dist
		let id = this.anim_id = window.requestAnimationFrame((time)=>{
			// if the animation was cancelled or another was started
			if (this.anim_id != id)
				return
			// delta time adjusted version of
			// new_dist = dist * (1-this.rate) @ 60fps
			let dt = Math.min((time-prev_time) / (1000/60), 2)
			let new_dist = dist * Math.pow(1-this.rate, dt)
			// abs allows animation to play backwards (for deleting)
			if (Math.abs(new_dist) <= 1)
				this.end_animation()
			else
				this.animate_insertion(new_dist, time)
		})
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
		Scroller.track_height.remove(this.inner)
		Scroller.track_height.remove(this.outer)
	}
}
Scroller.track_height = new ResizeTracker('height')
Scroller.anim_type = 2

//Object.seal(Scroller)
//Object.seal(Scroller.prototype)

// todo: we only want to animate if an element is inserted/removed/resized at the BOTTOM of the screen. but how to detect this? probably best, I suppose, if the chat room handles it?

// idea:

// imagine a message is inserted/deleted/edited in the MIDDLE of the visible area
// you want to only shift the content above it, not everything
// but how on earth would this even be implemented...

// could do something like
// have a list of all modified elements
// measure their heights before/after
// animate the height changes of those elements by setting their style.height

// idea: what if we, after an element is inserted, lock the scroll-inner height to its current value
// then, on inserting a new element, we expand the height to fit the new content
// have to use resizeobserver to adjust.. nnn
