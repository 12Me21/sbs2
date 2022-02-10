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
	}
	check_element(item, rect) {
		if (!item) return
		if (!rect.width) return //ignore changes for hidden elements
		if (rect[this.measure] == item.size) return //need to check if height changed in case of an ignored hide/show cycle
		//console.log("resize observed")
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
		this.animationId = null
		this.atBottom = true
		this.rate = 0.25 //autoscroll rate: amount of remaining distance to scroll per 1/60 second
		this.bottomHeight = 0.25 //if within this distance of bottom, autoscroll is enabled
		this.registerSizeChange()
		outer.addEventListener('scroll', (e)=>{
			if (this.ignoreScroll) {
				this.ignoreScroll = false
				return
			}
			if (this.hasSizeChanged()) {
				// should I do $.registerSizeChange() here?
				return
			}
			if (this.animationId)
				this.cancelAutoScroll()
			this.atBottom = this.scrollBottom < this.outer.clientHeight*this.bottomHeight
		}, {passive: true})
		
		let onResize = ()=>{
			this.registerSizeChange()
			if (this.atBottom && !this.animationId) // when message is inserted, it triggers the resize detector, which would interrupt the scroll animation, so we don't force scroll if an animation is playing
				this.scrollInstant()
		}
		track_scroll_resize.add(this.outer, onResize)
		track_scroll_resize.add(this.inner, onResize)
	}
	hasSizeChanged() {
		return this.innerHeight!=this.inner.getBoundingClientRect().height || this.outerHeight!=this.outer.getBoundingClientRect().height
	}
	registerSizeChange() {
		this.innerHeight = this.inner.getBoundingClientRect().height
		this.outerHeight = this.outer.getBoundingClientRect().height
	}
	get scrollBottom() {
		var parent = this.outer
		return parent.scrollHeight-parent.clientHeight-parent.scrollTop
	}
	set scrollBottom(value) {
		var parent = this.outer
		// need to round here because it would be reversed otherwise
		//value = value/window.devicePixelRatio)*window.devicePixelRatio
		parent.scrollTop = Math.ceil((parent.scrollHeight-parent.clientHeight-value)*window.devicePixelRatio)/window.devicePixelRatio
	}
	scrollInstant() {
		this.cancelAutoScroll()
		this.ignoreScroll = true
		this.scrollBottom = 0
		this.atBottom = true
	}
	autoScroll() {
		if (!window.requestAnimationFrame) {
			this.ignoreScroll = true
			this.scrollBottom = 0
			this.atBottom = true
			return
		}
		if (this.animationId)
			return
		/*this.animationId = null
		  var now = performance.now()
		  this.animationStart = now - 1000/60 //assume 60fps on first frame..
		  this.autoScrollAnimation(now)
		  // edited to start animation la-a-a-ater*/
		this.animationId = window.requestAnimationFrame((time)=>{
			var now = performance.now()
			//assume 60fps on first frame..
			this.animationStart = now - 1000/60
			this.autoScrollAnimation(now)
		})
	}
	cancelAutoScroll() {
		if (this.animationId) {
			window.cancelAnimationFrame(this.animationId)
			this.animationId = false
		}
	}
	autoScrollAnimation(time) {
		var dt = 1//(time - this.animationStart) / (1000/60)
		this.animationStart = time
		
		this.atBottom = true
		this.ignoreScroll = true
		
		// if we are more than 1 page up, just start scrolling at half a page
		if (this.scrollBottom > this.outer.clientHeight)
			this.scrollBottom = this.outer.clientHeight
		
		if (this.scrollBottom == this.oldScrollBottom) {
			this.animationId = null
			return
		} // PLEASE
		this.oldScrollBottom = this.scrollBottom
		
		this.scrollBottom = Math.floor(this.scrollBottom * Math.pow(1-this.rate, dt))
		if (this.scrollBottom <= 0.5) {
			this.animationId = null
			return
		}
		
		this.animationId = window.requestAnimationFrame((time)=>{
			this.autoScrollAnimation(time)
		})
	}
	//if you want to insert an element into the scroller, do something like:
	// scroller.handlePrint(function() {
	//    return document.createElement('div')  
	// }, true) // (or `false` to disable scrolling (for example, when inserting the initial elements, you might disable scrolling here and then run scroller.autoScroll(true) afterwards, to scroll to the bottom instantly)
	//(the reason it's inside a function is because it needs to run code
	// before AND after inserting the element)
	handlePrint(callback, autoscroll) {
		let should = autoscroll && this.atBottom
		try {
			let elem = callback()
			elem && this.inner.append(elem)
		} finally {
			should && this.autoScroll()
		}
	}
	handlePrintTop(callback) {
		var height = this.outer.scrollHeight
		var scroll = this.outer.scrollTop
		try {
			var elem = callback()
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
