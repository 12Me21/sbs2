function TrackResize2(element, callback) {
	var t = TrackResize2.tracking
	if (callback) {
		var n = {
			element: element,
			callback: callback,
			height: element.scrollHeight
		}
		if (TrackResize2.observer) {
			TrackResize2.observer.observe(element)
			t.set(element, n)
		} else {
			t.push(n)
		}
	} else {
		if (TrackResize2.observer) {
			TrackResize2.observer.unobserve(element)
			t['delete'](element)
		} else {
			for (var i=0; i<t.length; i++) {
				if (t[i].element == element) {
					t.splice(i, 1)
					break
				}
			}
		}
	}
}

if (window.ResizeObserver) {
	TrackResize2.tracking = new WeakMap()
	TrackResize2.observer = new ResizeObserver(function(events) {
		var t = TrackResize2.tracking
		events.forEach(function(event) {
			var item = t.get(event.target)
			if (item) {
				if (event.contentRect.width) { //ignore changes for hidden elements
					var height = event.contentRect.width
					if (height != item.height) { //need to check if height changed in case of an ignored hide/show cycle
						item.callback()
						item.height = height
					}
				}
			}
		})
	})
} else {
	TrackResize2.tracking = []
	TrackResize2.interval = window.setInterval(function() {
		TrackResize2.tracking.forEach(function(item) {
			var newSize = item.element.getBoundingClientRect()
			if (newSize.width && newSize.width!=item.height) {
				item.callback()
				item.height = newSize.width
			}
		})
	}, 200)
}

function TrackScrollResize(element, callback) {
	var t = TrackScrollResize.tracking
	if (callback) {
		var n = {
			element: element,
			callback: callback,
			height: element.getBoundingClientRect().height,
		}
		if (TrackScrollResize.observer) {
			TrackScrollResize.observer.observe(element)
			t.set(element, n)
		} else {
			t.push(n)
		}
	} else {
		if (TrackScrollResize.observer) {
			TrackScrollResize.observer.unobserve(element)
			t['delete'](element)
		} else {
			for (var i=0; i<t.length; i++) {
				if (t[i].element == element) {
					t.splice(i, 1)
					break
				}
			}
		}
	}
}

if (window.ResizeObserver) {
	TrackScrollResize.tracking = new WeakMap()
	TrackScrollResize.observer = new ResizeObserver(function(events) {
		var t = TrackScrollResize.tracking
		events.forEach(function(event) {
			var item = t.get(event.target)
			if (item) {
				if (event.contentRect.width) { //ignore changes for hidden elements
					var height = event.contentRect.height
					if (height != item.height) { //need to check if height changed in case of an ignored hide/show cycle
						

						item.callback(item.height, event.contentRect.height)
						item.height = event.contentRect.height
					}
				}
			}
		})
	})
} else {
	TrackScrollResize.tracking = []
	TrackScrollResize.interval = window.setInterval(function() {
		TrackScrollResize.tracking.forEach(function(item) {
			var newSize = item.element.getBoundingClientRect()
			if (newSize.width && newSize.height!=item.height) {
				item.callback(item.height, newSize.height)
				item.height = newSize.height
			}
		})
	}, 200)
}

// goal:
// any unnatural resize -> scroll to bottom if atbottom set
// human scrolling -> update atbottom flag
// message insert -> smooth scroll

// what is human scrolling?
//  scroll position changes without the element size changing or a message being inserted

function Scroller(outer, inner) {
	this.outer = outer
	this.inner = inner
	this.animationId = null
	this.atBottom = true
	this.rate = 0.25 //autoscroll rate: amount of remaining distance to scroll per 1/60 second
	this.bottomHeight = 0.25 //if within this distance of bottom, autoscroll is enabled
	this.registerSizeChange()
	var $=this
	outer.addEventListener('scroll', function(e) {
		if ($.ignoreScroll) {
			$.ignoreScroll = false
			return
		}
		if ($.hasSizeChanged()) {
			// should I do $.registerSizeChange() here?
			return
		}
		if ($.animationId)
			$.cancelAutoScroll()
		$.atBottom = $.scrollBottom < $.outer.clientHeight*$.bottomHeight
	}, {passive: true})
	
	function onResize() {
		$.registerSizeChange()
		if ($.atBottom && !$.animationId) // when message is inserted, it triggers the resize detector, which would interrupt the scroll animation, so we don't force scroll if an animation is playing
			$.scrollInstant()
	}
	TrackScrollResize(this.outer, onResize)
	TrackScrollResize(this.inner, onResize)
}
Scroller.prototype.hasSizeChanged = function() {
	return this.innerHeight!=this.inner.getBoundingClientRect().height || this.outerHeight!=this.outer.getBoundingClientRect().height
}
Scroller.prototype.registerSizeChange = function() {
	this.innerHeight = this.inner.getBoundingClientRect().height
	this.outerHeight = this.outer.getBoundingClientRect().height
}
Object.defineProperty(Scroller.prototype, 'scrollBottom', {
	get: function() {
		var parent = this.outer
		return parent.scrollHeight-parent.clientHeight-parent.scrollTop
	},
	set: function(value) {
		var parent = this.outer
		// need to round here because it would be reversed otherwise
		value = Math.floor(value)
		parent.scrollTop = parent.scrollHeight-parent.clientHeight-value
	}
})
Scroller.prototype.scrollInstant = function() {
	this.cancelAutoScroll()
	this.ignoreScroll = true
	this.scrollBottom = 0
	this.atBottom = true
}
Scroller.prototype.autoScroll = function() {
	if (!window.requestAnimationFrame) {
		this.ignoreScroll = true
		this.scrollBottom = 0
		this.atBottom = true
	} else {
		var $=this
		if (!this.animationId) {
			/*this.animationId = null
			var now = performance.now()
			this.animationStart = now - 1000/60 //assume 60fps on first frame..
			this.autoScrollAnimation(now)*/
			// edited to start animation la-a-a-ater
			this.animationStart = performance.now()
			this.animationId = window.requestAnimationFrame(function(time) {
				$.autoScrollAnimation(time)
			})
		}
	}
}
Scroller.prototype.cancelAutoScroll = function() {
	if (this.animationId) {
		window.cancelAnimationFrame(this.animationId)
		this.animationId = false
	}
}
Scroller.prototype.autoScrollAnimation = function(time) {
	var dt = (time - this.animationStart) / (1000/60)
	this.animationStart = time

	this.ignoreScroll = true
	var expect = Math.floor(this.scrollBottom * Math.pow(1-this.rate, dt))
	this.scrollBottom = expect
	
	this.atBottom = true
	if (this.scrollBottom <= 0.5) { // done
		this.animationId = null
		return
	}
	var $=this
	this.animationId = window.requestAnimationFrame(function(time) {
		$.autoScrollAnimation(time)
	})
}
//if you want to insert an element into the scroller, do something like:
// scroller.handlePrint(function() {
//    return document.createElement('div')  
// }, true) // (or `false` to disable scrolling (for example, when inserting the initial elements, you might disable scrolling here and then run scroller.autoScroll(true) afterwards, to scroll to the bottom instantly)
//(the reason it's inside a function is because it needs to run code
// before AND after inserting the element)
Scroller.prototype.handlePrint = function(callback, autoscroll) {
	var should = autoscroll && this.atBottom
	var elem = callback()
	if (elem)
		this.inner.appendChild(elem)
	if (should)
		this.autoScroll()
}

Scroller.prototype.handlePrintTop = function(callback) {
	var height = this.outer.scrollHeight
	var scroll = this.outer.scrollTop
	var elem = callback()
	if (elem)
		this.inner.appendChild(elem)
	this.outer.scrollTop = scroll + (this.outer.scrollHeight-height)
}

Scroller.prototype.destroy = function() {
	//disable resize tracking
	TrackScrollResize(this.inner, null)
	TrackScrollResize(this.outer, null)
}
