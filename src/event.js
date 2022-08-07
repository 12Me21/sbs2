// - Views can register event listeners for certain event types and content ids etc.

// - when a View is unloaded, its event listeners are removed

// - socket, sidebar [insert] button, etc. sends events here.

// - this system dispatches events to the listeners

class Listeners {
	constructor() {
		this.listeners = []
	}
	listen(view, callback) {
		return this.listen2(this.listeners, view, callback)
	}
	fire(...data) {
		return this.fire2(this.listeners, ...data)
	}
	listen2(list, view, callback) {
		list.push({view, callback})
	}
	fire2(list, ...data) {
		if (list)
			for (let l of list)
				try {
					l.callback.call(l.view, ...data)
				} catch (e) {
					console.error('event handler error', e)
					print(e)
				}
	}
	on_destroy(view) {
		return this.destroy2(this.listeners, view)
	}
	destroy2(list, view) {
		for (let i=0; i<list.length; i++) {
			if (list[i].view==view) {
				list.splice(i, 1)
				i--
			}
		}
	}
}

class IdListeners extends Listeners {
	constructor() {
		super()
		this.ids = {__proto__: null}
	}
	listen_id(view, id, callback) {
		let ll = this.ids[id] || (this.ids[id] = [])
		return super.listen2(ll, view, callback)
	}
	fire_id(id, ...data) {
		return super.fire2(this.ids[id], ...data)
	}
	on_destroy(view) {
		for (let id in this.ids) {
			// todo: what if the array was instead a Map of view -> callback?
			// then, we just call .delete
			// and, for registering events which aren't attached to a View, we can pass really any object, or a symbol, or etc.
			super.destroy2(this.ids[id], view)
		}
		super.on_destroy(view)
	}
}

//todo:  we need a cooler codename for this
let Events = {
	__proto__: {
		__proto__: null,
		destroy(self) {
			Object.for(this, lm=>lm.on_destroy(self))
		},
		/*on(type, self, callback) {
			let lm = this[type] || (this[type] = new IdListeners())
			lm.listen(self, callback)
		},
// i think .on is better, since it means you won't get an error,
// if you try to register a handler before the category is defined
// which might happen late, for custom events
// also, its probably better anyway, to not have a class for each event type
// and instead just like, .. gosh idk.. maybe  nnnnnnnnn the classes might be good though..hhhhhhhh
		fire(type, ...data) {
			let lm = this[type]
			if (lm)
				lm.fire(...data)
		}*/
	},
	// map of {eventname,pid} -> array
	// array consists of
	// {view, callback}
	messages: new IdListeners(),
	after_messages: new IdListeners(),
	content_edit: new IdListeners(),
	user_edit: new Listeners(),
	userlist: new IdListeners(),
	setting: new IdListeners(),
}

/*function evt_messages(comments) {
	this.scroller.lock()
	this.display_messages(comments)
}

function evt_after_messages() {
	this.scroller.unlock()
}
*/
