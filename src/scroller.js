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
					let m = rect[this.measure]
					//ignore changes for hidden and unchanged elements
					if (rect.width && m!=item.size) {
						item.callback(item.size) // pass old size
						item.size = m
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
		this.$outer = outer
		this.$inner = inner
		
		let middle = document.createElement('scroll-middle')
		middle.append(this.$inner)
		this.$outer.append(middle)
		
		this.dist = null
		this.anim_type = Scroller.anim_type
		this.anim = null
		this.locked = false
		this.before = null
		
		this.reverse = Scroller.reverse
		if (this.anim_type==2)
			this.$inner.classList.add('scroll-anim3')
		if (this.reverse)
			this.$outer.classList.add('anchor-bottom')
		
		// autoscroll is enabled within this distance from the bottom
		this.bottom_region = 10
		
		// i think it might not be totally reliable if both these fire at once...
		if (!this.reverse) {
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
		if (this.reverse)
			return -top < this.bottom_region
		return scroll-outer-top < this.bottom_region
	}
	scroll_instant() {
		this.$outer.scrollTop = this.reverse ? 0 : 9e9
	}
	scroll_height() {
		// $inner.GBCR().height = $inner.clientHeight = outer.scrollHeight
		// but the latter 2 are rounded to integers
		
		// for detecting size change during print, 
		// could use scrollTop instead of scroll_height()
		// since scroll_instant() will increase it by the distance added.
		// except, this doesnt work until the $inner height is > outer height (i.e. not when the container is mostly empty)
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
			if (before != after)
				this.$outer.scrollTop -= Math.round(after-before)
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
	name: 'scroller_anchor', label: "Scroller Anchor", type: 'select',
	options: ['top', 'bottom'],
	options_labels: ['top', 'bottom (unstable!)'],
	update(value) {
		Scroller.reverse = value=='bottom'
	},
})

// todo:
// - use the reverse scroller trick (flex-flow: column reverse on scroll-outer), as an option, for browsers which can handle it. it looks a lot better than the current system, when DPR is not an integer.
// - manage resize events better. track current height in a variable and reuse this, etc.  need to improve this in order to adjust pos when uhh new messages posted in reverse mode.
// actually nevermind we can rely on scroll anchoring alone?
// nice hmm..
// so yeah just have a setting to enable the reverse mode and that's it?
// just need to play the anim when a new message is posted if you're at the bottom, otherwise do nothing!
