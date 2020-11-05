function Scroller(outer, inner) {
	this.outer = outer
	this.inner = inner
	this.animationId = null
	this.rate = 0.25 //autoscroll rate: amount of remaining distance to scroll per frame
	this.bottomHeight = 100 //if within this distance of bottom, autoscroll is enabled
	var $=this
}
Scroller.prototype.scrollInstant = function() {
	this.cancelAutoScroll()
	this.ignoreScroll = true
	this.outer.scrollTop = 0
}
Scroller.prototype.atBottom = function() {
	return -this.outer.scrollTop < this.bottomHeight
}
Scroller.prototype.autoScroll = function() {
	if (!window.requestAnimationFrame) {
		this.scrollInstant()
	} else {
		var $=this
		if (!this.animationId) {
			/*this.animationId = null
			var now = performance.now()
			this.animationStart = now - 1000/60 //assume 60fps on first frame..
			this.autoScrollAnimation(now)
			// edited to start animation la-a-a-ater*/
			this.animationId = window.requestAnimationFrame(function(time) {
				var now = performance.now()
				$.animationStart = now - 1000/60 //assume 60fps on first frame..
				$.autoScrollAnimation(now)
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
	var dt = 1//(time - this.animationStart) / (1000/60)
	this.animationStart = time

	this.ignoreScroll = true

	this.outer.scrollTop = this.outer.scrollTop * Math.pow(1-this.rate, dt)
	if (this.outer.scrollTop == 0) {
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
	var oldHeight = this.outer.scrollHeight
	try {
		var elem = callback()
		if (elem)
			this.inner.appendChild(elem)
	} finally {
		this.outer.scrollTop = -(this.outer.scrollHeight - oldHeight)
		console.log(this.atBottom(), "A")
		if (autoscroll && this.atBottom())
			this.autoScroll()
	}
}

Scroller.prototype.handlePrintTop = function(callback) {
	var elem = callback()
	if (elem)
		this.inner.appendChild(elem)
}

Scroller.prototype.destroy = function() {
}
