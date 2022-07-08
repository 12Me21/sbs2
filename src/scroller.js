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


class Scroller {
	constructor(outer, inner) {
		this.outer = outer
		this.inner = inner
		
		this.middle = document.createElement('scroll-middle')
		this.middle.append(this.inner)
		this.outer.append(this.middle)
		
		this.anim_type = Scroller.anim_type
		this.anim = null
		this.moving = false
		if (this.anim_type==2)
			this.inner.classList.add('scroll-anim3')
		
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
	at_bottom(outer=this.outer.clientHeight, scroll=this.outer.scrollHeight) {
		return scroll-outer-this.outer.scrollTop < this.bottom_region
	}
	scroll_instant() {
		this.outer.scrollTop = 9e9
	}
	scroll_height() {
		// inner.GBCR().height = inner.clientHeight = outer.scrollHeight
		// but the latter 2 are rounded to integers
		return this.inner.getBoundingClientRect().height
	}
	set_offset(y) {
		this.inner.style.transform = y ? `translateY(${y}px)` : ""
	}
	print_top(fn) {
		// eh
		fn()
	}
	print(fn, smooth) {
		if (!this.at_bottom()) {
			fn()
			return
		}
		this.cancel_animation()
		// could use scrollTop instead of scroll_height()
		// since scroll_instant() will increase it by the distance added.
		// except, this doesnt work until the inner height is > outer height (i.e. not when the container is mostly empty)
		let before = smooth && this.scroll_height()
		//
		try {
			fn()
		} finally {
			this.scroll_instant()
			if (!smooth)
				return
			let after = this.scroll_height()
			let dist = after - before
			if (Math.abs(dist) <= 1)
				return
			//this.override_height = smooth ? null : false
			this.anim = requestAnimationFrame(time=>{
				this.moving = true
				this.anim = null
				if (this.anim_type==2) {
					this.inner.style.transition = "none"
					this.set_offset(dist)
					void this.inner.offsetWidth
					this.inner.style.transition = ""
					this.set_offset()
				} else if (this.anim_type==1) {
					this.anim_step(dist, time)
				}
			})
		}
	}
	cancel_animation() {
		if (this.anim)
			cancelAnimationFrame(this.anim)
		this.anim = null
		if (!this.moving)
			return
		this.moving = false
		if (this.anim_type==2) {
			this.inner.style.transition = "none"
		} else if (this.anim_type==1) {
			this.set_offset()
		}
	}
	// mode 1 only
	anim_step(dist, prev_time) {
		this.set_offset(dist)
		this.anim = window.requestAnimationFrame(time=>{
			this.anim = null
			let dt = Math.min((time-prev_time) / (1000/60), 2)
			dist *= Math.pow(0.75, dt)
			if (Math.abs(dist) <= 1) {
				this.set_offset()
				this.moving = false
			} else
				this.anim_step(dist, time)
		})
	}
	destroy() {
		// probably unneccessary but idk.. memory leaks
		Scroller.track_height.remove(this.inner)
		Scroller.track_height.remove(this.outer)
	}
}
Scroller.track_height = new ResizeTracker('height')
Scroller.anim_type = 2
