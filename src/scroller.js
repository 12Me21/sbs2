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

let track_scroll_resize = new ResizeTracker('height')

// goal:
// any unnatural resize -> scroll to bottom if atbottom set
// human scrolling -> update atbottom flag
// message insert -> smooth scroll

// what is human scrolling?
//  scroll position changes without the element size changing or a message being inserted

class Scroller {
	constructor(outer, inner) {
		this.outer = outer
		this.inner = inner
		this.animation = null
		this.animation_start = null
		this.at_bottom = true
		this.ignore_scroll = false
		this.old_scroll_bottom = null
		this.rate = 0.25 //autoscroll rate: amount of remaining distance to scroll per 1/60 second
		this.bottom_height = 0.25 //if within this distance of bottom, autoscroll is enabled
		this.register_size_change()
		outer.addEventListener('scroll', (e)=>{
			if (this.ignore_scroll) {
				this.ignore_scroll = false
				return
			}
			if (this.size_changed()) {
				// should I do $.register_size_change() here?
				return
			}
			if (this.animation)
				this.cancel_scroll()
			this.at_bottom = this.scrollBottom < this.outer.clientHeight*this.bottom_height
		}, {passive: true})
		
		let onResize = ()=>{
			this.register_size_change()
			if (this.at_bottom && !this.animation) // when message is inserted, it triggers the resize detector, which would interrupt the scroll animation, so we don't force scroll if an animation is playing
				this.scroll_instant()
		}
		// todo: if multiple chat rooms are loaded,
		// the outer elements should all bbbe the same size?
		// - no, because of the userlist and page resizing
		track_scroll_resize.add(this.outer, onResize)
		track_scroll_resize.add(this.inner, onResize)
		Object.seal(this)
	}
	size_changed() {
		return this.inner_height!=this.inner.getBoundingClientRect().height || this.outer_height!=this.outer.getBoundingClientRect().height
	}
	register_size_change() {
		this.inner_height = this.inner.getBoundingClientRect().height
		this.outer_height = this.outer.getBoundingClientRect().height
	}
	get_max_scroll() {
		let top = this.outer.scrollTop
		this.outer.scrollTop = 1e9
		let max = this.outer.scrollTop
		this.outer.scrollTop = top
		return max
	}
	get scrollBottom() {
		let parent = this.outer
		return parent.scrollHeight-parent.clientHeight-parent.scrollTop
	}
	get scrollBottom2() {
		return this.get_max_scroll() - this.outer.scrollTop
	}
	set scrollBottom(value) {
		let parent = this.outer
		// need to round here because it would be reversed otherwise
		//value = value/window.devicePixelRatio)*window.devicePixelRatio
		parent.scrollTop = Math.ceil((parent.scrollHeight-parent.clientHeight-value)*window.devicePixelRatio)/window.devicePixelRatio
		//from chat.js:
		//value = Math.floor(value*window.devicePixelRatio)/window.devicePixelRatio
		//let parent = this.messages_outer
		//parent.scrollTop = parent.scrollHeight-parent.clientHeight-value
	}
	scroll_instant() {
		this.cancel_scroll()
		this.ignore_scroll = true
		this.scrollBottom = 0
		this.at_bottom = true
	}
	autoscroll() {
		if (!window.requestAnimationFrame) {
			this.ignore_scroll = true
			this.scrollBottom = 0
			this.at_bottom = true
			return
		}
		if (this.animation)
			return
		/*this.animation = null
		  var now = performance.now()
		  this.animation_start = now - 1000/60 //assume 60fps on first frame..
		  this.scroll_animation(now)
		  // edited to start animation la-a-a-ater*/
		this.animation = window.requestAnimationFrame((time)=>{
			let now = performance.now()
			//assume 60fps on first frame..
			//this.animation_start = now - 1000/60
			this.scroll_animation(now)
		})
	}
	cancel_scroll() {
		if (this.animation) {
			window.cancelAnimationFrame(this.animation)
			this.animation = false
		}
	}
	scroll_animation(time) {
		let dt = 1//(time - this.animation_start) / (1000/60)
		//this.animation_start = time // unused
		
		this.at_bottom = true
		this.ignore_scroll = true
		
		// if we are more than 1 page up, just start scrolling at half a page
		if (this.scrollBottom > this.outer.clientHeight)
			this.scrollBottom = this.outer.clientHeight
		
		if (this.scrollBottom == this.old_scroll_bottom) {
			this.animation = null
			return
		} // PLEASE
		this.old_scroll_bottom = this.scrollBottom
		
		this.scrollBottom = Math.floor(this.scrollBottom * Math.pow(1-this.rate, dt))
		if (this.scrollBottom <= 0.5) {
			this.animation = null
			return
		}
		
		this.animation = window.requestAnimationFrame((time)=>{
			if (!this.animation) // was cancelled. i JUST added this check and i bet it fixes something...
				return
			this.scroll_animation(time)
		})
	}
	//if you want to insert an element into the scroller, do something like:
	// scroller.print(function() {
	//    return document.createElement('div')
	// }, true) // (or `false` to disable scrolling (for example, when inserting the initial elements, you might disable scrolling here and then run scroller.autoScroll(true) afterwards, to scroll to the bottom instantly)
	//(the reason it's inside a function is because it needs to run code
	// before AND after inserting the element)
	print(callback, autoscroll) {
		let should = autoscroll && this.at_bottom
		try {
			let elem = callback()
			elem && this.inner.append(elem)
		} finally {
			should && this.autoscroll()
		}
	}
	print_top(callback) {
		let height = this.outer.scrollHeight
		let scroll = this.outer.scrollTop
		try {
			let elem = callback()
			elem && this.inner.prepend(elem)
		} finally {
			this.outer.scrollTop = scroll + (this.outer.scrollHeight-height)
		}
	}
	destroy() {
		//disable resize tracking
		track_scroll_resize.remove(this.inner)
		track_scroll_resize.remove(this.outer)
	}
}
