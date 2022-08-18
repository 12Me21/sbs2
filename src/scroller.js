'use strict'

class ResizeTracker {
	constructor(measure) {
		this.measure = measure
		// ResizeObserver is a very new feature (added in ~2020)
		if (window.ResizeObserver) {
			this.tracking = new WeakMap()
			this.observer = new ResizeObserver(events=>{
				for (let {target, contentRect} of events)
					this.handle(target, contentRect)
			})
		} else {
			this.tracking = new Map()
			this.observer = {observe(){}, unobserve(){}}
			// this never gets cleared uhh
			this.interval = window.setInterval(()=>{
				for (let target of this.tracking.keys())
					this.handle(target, target.getBoundingClientRect())
			}, 200)
		}
		Object.seal(this)
	}
	handle(target, rect) {
		let item = this.tracking.get(target)
		let dim = rect[this.measure]
		//ignore changes for hidden and unchanged elements
		if (rect.width && dim!=item.size) {
			item.callback(item.size) // pass old size
			item.size = dim
		}
	}
	add(element, callback) {
		this.observer.observe(element)
		let size = element.getBoundingClientRect()[this.measure]
		this.tracking.set(element, {callback, size})
	}
	remove(element) {
		this.observer.unobserve(element)
		this.tracking.delete(element)
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

// idea: what if we, after an element is inserted, lock the scroll-inner height to its current value
// then, on inserting a new element, we expand the height to fit the new content
// have to use resizeobserver to adjust.. nnn

// todo:
// - manage resize events better. track current height in a variable and reuse this, etc.  need to improve this in order to adjust pos when uhh new messages posted in reverse mode.
class Scroller {
	constructor(outer, inner) {
		this.$outer = outer
		this.$inner = inner
		
		let middle = document.createElement('scroll-middle')
		middle.append(this.$inner)
		this.$outer.append(middle)
		
		this.anim = null
		this.locked = false
		this.before = null
		// autoscroll is enabled within this distance from the bottom
		this.bottom_region = 10
		
		this.anim_type = Scroller.anim_type
		if (this.anim_type==2)
			this.$inner.classList.add('scroll-anim3')
		
		this.reverse = Scroller.reverse
		if (this.reverse) {
			this.$outer.classList.add('anchor-bottom')
			this.at_bottom = function() {
				return -this.$outer.scrollTop < this.bottom_region
			}
		} else {
			// i think it might not be totally reliable if both these fire at once...
			Scroller.track_height.add(this.$outer, (old_size)=>{
				if (this.at_bottom(old_size, undefined))
					this.scroll_instant()
			})
			Scroller.track_height.add(this.$inner, (old_size)=>{
				if (this.at_bottom(undefined, old_size))
					this.scroll_instant()
			})
		}
		
		Object.seal(this)
	}
	at_bottom(outer=this.$outer.clientHeight, scroll=this.$outer.scrollHeight) {
		// todo: we use this.outer.scrollHeight in at_bottom, then later access $inner.gbcr().height for scroll_height()
		// so, i suppose we could reuse the value
		// alternatively, what if we just stored the old value of scroll_bottom during resize? we can also calculate it by comparing the rects uhh
		// outer.bottom vs inner.bottom
		
		// yeah it might be better actually, if we measured the bottom position rather than 
		let top = this.$outer.scrollTop
		return scroll-outer-top < this.bottom_region
	}
	scroll_instant() {
		this.$outer.scrollTop = this.reverse ? 0 : 9e9
	}
	scroll_height() {
		return this.$inner.getBoundingClientRect().height
	}
	set_offset(y) {
		this.$inner.style.transform = y ? `translateY(${y}px)` : ""
	}
	print_top(fn) {
		// eh
		// i think we're saved by scroll anchoring here, or something
		fn(this.$inner)
	}
	// TODO: instead of this complex stateless stuff, we should just track one pending anim
	// since we can only play one at once anyway
	// like, when before_print is called, capture the current state (UNLESS before_print has already been called, in which case we ignore the second call (as well as the subsequent extra after_print?)),
	// and after print will proceed based on those values, when called.
	before_print(smooth) {
		// not scrolled to bottom, don't do anything
		if (!this.at_bottom()) {
			if (this.reverse) {
				return -this.scroll_height()
			} else
				return 'none'
		}
		// anim disabled
		if (!smooth || this.anim_type==0 || 'visible'!=document.visibilityState)
			return 'instant'
		// at bottom + anim enabled
		// note: stop trying to use scrollheight instead, it wont work when the elem isnt tall enough!
		return this.scroll_height()
	}
	after_print(before) {
		if (this.reverse && 'number'==typeof before && before<0) {
			let after = this.scroll_height()
			before = -before
			if (before != after)
				this.$outer.scrollTop -= after-before
			return
		}
		if (this.locked) {
			this.before = before
			return
		}
		if (before==='none')
			return
		if (before==='instant') {
			this.scroll_instant()
			if (this.anim_type!=0)
				this.cancel_animation()
			return
		}
		let after = this.scroll_height()
		let dist = after - before
		if (Math.abs(dist) <= 1) {
			this.scroll_instant()
			return
		}
		// make sure no existing animation is happening
		// todo: somehow continue the current animation rather than
		if (this.anim)
			cancelAnimationFrame(this.anim)
		
		if (this.anim_type==2)
			this.$inner.style.transitionProperty = "none"
		this.set_offset(dist)
		
		this.scroll_instant()
		if (this.anim_type==2)
			this.$inner.style.transitionProperty = ""
		
		this.anim_step(dist)
	}
	print(fn, smooth) {
		let x = this.before_print(smooth)
		try {
			fn(this.$inner)
		} finally {
			this.after_print(x)
		}
	}
	lock() {
		if (!this.locked) {
			this.locked = true
			this.before = null
		}
	}
	unlock() {
		if (this.locked) {
			this.locked = false
			if (this.before!=null)
				this.after_print(this.before)
		}
	}
	cancel_animation() {
		if (this.anim)
			cancelAnimationFrame(this.anim)
		this.anim = null
		if (this.anim_type==2)
			this.$inner.style.transitionProperty = "none"
		this.set_offset()
	}
	// mode 1 only
	anim_step(dist, prev_time=document.timeline.currentTime) {
		this.anim = window.requestAnimationFrame(time=>{
			this.anim = null
			// ideally we should cancel the animation when the document stops being visible
			// but there's no easy way to attach the event listener without creating a memory leak, of course
			if ('visible'!=document.visibilityState) {
				this.cancel_animation()
				return
			}
			if (this.anim_type==2) {
				this.set_offset()
				return
			}
			let dt = (time-prev_time) / (1000/60)
			dist *= Math.pow(0.75, Math.min(dt, 2))
			if (Math.abs(dist) <= 1) {
				this.set_offset()
			} else {
				this.set_offset(dist)
				this.anim_step(dist, time)
			}
		})
	}
	destroy() {
		// probably unneccessary but idk.. memory leaks
		// i don't think we actually call this reliably though?
		// honestly uhh i think we just need to rely on it being cleared
		// automatically
		// oh except our polyfill thing .. heck
		Scroller.track_height.remove(this.$inner)
		Scroller.track_height.remove(this.$outer)
	}
}
Scroller.track_height = new ResizeTracker('height')
Scroller.anim_type = 2
Scroller.reverse = false

//document.addEventListener('visibilitychange', )

Settings.add({
	name: 'scroller_anim_type', label: "Smooth Scrolling", type: 'select',
	options: ['1', '2', '0'],
	options_labels: ['original', 'css animation', 'disabled'],
	update(value) {
		Scroller.anim_type = +value
	},
})
Settings.add({
	name: 'scroller_anchor', label: "Scroller Origin", type: 'select',
	options: ['top', 'bottom'],
	options_labels: ['top', 'bottom (unstable!)'],
	update(value) {
		Scroller.reverse = value=='bottom'
	},
})
