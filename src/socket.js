'use strict'
// todo: if we're disconnected for a long time, we might lose sync
// so, at that point there's really no way to recover (also we need to re-request our user object in case it updated)

// todo: if the server restarts, lastid is reset
// so, we need to be careful about sorting etc. bc of this discontinuity

class SocketRequestError extends TypeError {
	constructor(resp, extra) {
		super()
		this.trim_stack(1)
		this.resp = resp
		this.message = "\n"+resp.error
	}
}
SocketRequestError.prototype.name = "SocketRequestError"

const Lp = NAMESPACE({
	handlers: new Map(),
	handler_id: 1,
	ready: false,
	last_id: "",
	no_restart: false,
	websocket: null,
	state_change(state, ping) {
		// TODO: also use yellow state for when a request has been sent but not recieved yet.
		// (maybe use a less annoying color)
		// and maybe combine this all with the header color instead of the button. (also, display in mobile sidebar somehow?)
		document.documentElement.dataset.socketState = state
	},
	statuses: {},
	status_queue: {},
	set_status(id, s) {
		this.statuses[id] = s
		this.status_queue[id] = s
	},
	handler_count() {
		// todo: only count 'important' handlers
		// not, ex: user status
		let num = this.handlers.size
		if (num)
			document.documentElement.dataset.socketPending = num
		else
			delete document.documentElement.dataset.socketPending
		//do_when_ready(x=>$socketPending.textContent = [...this.handlers.keys()].join(" "), 'socket-pending')
	},
	flush_statuses(callback) {
		this.request({type:'setuserstatus', data:this.status_queue}, ({x})=>{
			this.status_queue = {}
			callback()
		})
	},
	stop() {
		if (this.websocket)
			this.websocket.close()
	},
	on_ready() {
		Object.assign(this.status_queue, this.statuses)
		this.flush_statuses(()=>{})
		for (let {request} of this.handlers.values())
			this.send(request)
		this.ready = true
	},
	kill_websocket() {
		if (this.websocket) {
			this.state_change('dead')
			this.ready = false
			this.websocket.onerror = null
			this.websocket.onopen = null
			this.websocket.onclose = null
			this.websocket.onmessage = null
			this.websocket.close()
			this.websocket = null
		}
	},
	is_alive() {
		return this.websocket && this.websocket.readyState <= WebSocket.OPEN
	},
	fails: 0,
	last_reconnect: 0,
	last_message: Date.now(),
	pending_retry: null,
	cancel_retry() {
		if (this.pending_retry) {
			window.clearTimeout(this.pending_retry)
			this.pending_retry = null
		}
	},
	schedule_retry(time, force) {
		this.cancel_retry()
		this.pending_retry = window.setTimeout(()=>{
			this.pending_retry = null
			this.start_websocket(force)
		}, time)
	},
	maybe_reconnect(e) {
		if (Settings.values.socket_debug=='yes')
			print('maybe reconnect '+(e?e.type:""))
		if (this.no_restart)
			return
		let last = this.last_reconnect
		this.last_reconnect = Date.now()
		if ('visible'==document.visibilityState && navigator.onLine) {
			if (this.is_alive()) {
				if (this.last_reconnect-last < 1000)
					return
				let time = 2000
				if (Date.now()-this.last_message > 30*1000 && (e&&e.type!='focus'))
					time = 1000
				this.schedule_retry(time, true)
				this.ping(()=>{})
			} else {
				if (this.fails > 5) {
					print('too many ')
					return
				}
				if (this.last_reconnect-last < 1000) {
					this.schedule_retry(1000)
				} else
					this.start_websocket()
			}
		}
	},
	start_websocket(force) {
		this.cancel_retry()
		if (this.no_restart)
			return
		if (!force && this.is_alive())
			throw new Error("Tried to open multiple websockets")
		this.kill_websocket()
		print('starting websocket...')
		this.last_reconnect = Date.now()
		this.fails++
		this.websocket = new WebSocket(`wss://${Req.server}/live/ws?lastId=${this.last_id}&token=${encodeURIComponent(Req.auth)}`)
		this.state_change('opening')
		
		this.websocket.onopen = e=>{
			console.log("🌄 websocket open")
			this.cancel_retry()
			this.state_change('open')
			this.on_ready()
		}
		
		this.websocket.onerror = ({target})=>{
			console.warn("websocket error")
			this.fails++
			target.got_error = true
		}
		
		this.websocket.onclose = ({code, reason, wasClean, target})=>{
			console.log("ws closed", code, reason, wasClean)
			let desc
			if (target.got_error)
				desc = "websocket closed 📶 (connection error)."
			else if (wasClean)
				desc = "websocket closed (clean)."
			else
				desc = "websocket closed."
			print(desc+"\n "+code+" "+reason)
			
			this.ready = false
			this.state_change('dead')
			// use timeout to avoid recursion and leaking stack traces
			window.setTimeout(()=>this.maybe_reconnect())
		}
		
		this.websocket.onmessage = ({origin, data, target})=>{
			if (target !== this.websocket) {
				alert("websocket wrong event target? multiple sockets still open?")
				return
			}
			this.cancel_retry()
			this.last_message = Date.now()
			this.fails = 0
			this.handle_response(JSON.parse(data))
		}
	},
	/*************************
	 ** Requests (internal) **
	 *************************/
	send(data) {
		this.websocket.send(JSON.stringify(data))
	},
	next_id() {
		return "🧦"+this.handler_id++
	},
	/***************************
	 ** Requests (high level) **
	 ***************************/
	request(request, callback=console.info) {
		request.id = this.next_id()
		this.handlers.set(request.id, {request, callback})
		this.handler_count()
		if (this.ready)
			this.send(request)
		return {id: request.id}
	},
	chain(data, callback) {
		return this.request({type:'request', data}, callback)
	},
	ping(callback) {
		return this.request({type:'ping'}, callback)
	},
	userlist(callback) {
		return this.request({type:'userlist'}, callback)
	},
	
	cancel({id}) {
		this.pop_handler(id)
	},
	/***********************
	 ** Response Handling **
	 ***********************/
	pop_handler(id) {
		let handler = this.handlers.get(id)
		if (this.handlers.delete(id)) {
			this.handler_count()
			return handler
		}
	},
	handle_response(response) {
		if (response.type=='unexpected' && /ExpiredCheckpoint/.test(response.error)) {
			print("server restart, lastid reset?")
			this.last_id = 0
			return
		}
		if (response.type=='badtoken') {
			this.no_restart = true
			alert("token expired (must log in again)")
			return
		}
		
		let handler
		if (response.id) {
			handler = this.pop_handler(response.id)
			if (!handler)
				console.warn("got response without handler:", response)
		}
		if (response.error) {
			let err = new SocketRequestError(response)
			if (handler && handler.request.type == response.type)
				handler.callback(SELF_DESTRUCT(err), err)
			throw err
			return
		}
		let data = response.data
		switch (response.type) { default: {
			console.warn("unknown response type: ", response)
		} break;case 'request': {
			Entity.do_listmap(data.objects)
			handler && handler.callback(data.objects)
		} break;case 'setuserstatus': {
			handler && handler.callback(response)
		} break;case 'userlist': {
			Entity.do_listmap(data.objects)
			handler && handler.callback(data)
		} break;case 'ping': {
			handler && handler.callback(response)
			
		} break;case 'lastId': {
			this.last_id = data
		} break;case 'live': {
			this.last_id = data.lastId
			// activity parent object field
			let a = data.objects.activity_event
			if (a && a.parent) a.parent.Type = 'content'
			Entity.do_listmapmap(data.objects)
			this.process_live(data.events, data.objects)
		} break;case 'userlistupdate': {
			Entity.do_listmap(data.objects)
			StatusDisplay.update(data.statuses, data.objects)
		} break;case 'badtoken': {
			//
		} }
		
	},
	process_live(events, listmapmap) {
		let comments = []
		Entity.ascending(events)
		let prev_id = -Infinity
		for (let event of events) {
			if (event.id < prev_id) {
				alert("event ids out of order! please report this")
				print(JSON.stringify(events))
				console.warn(events)
			}
			prev_id = event.id
			// wait shouldnt listmapmap be called maplistmap?
			let maplist = listmapmap[event.type]
			let ref_id = event.refId
			
			switch (event.type) { default: {
				console.warn("unknown event type:", event.type, event, maplist)
			} break; case 'message_event': {
				let message = maplist.message[~ref_id]
				if (message)
					comments.push(message)
			/*} break; case 'activity_event': {
				let act = maplist.activity[~ref_id]*/
			} break; case 'watch_event': {
				let watch = maplist.watch[~ref_id]
				console.log('watch event', watch, event)
			} break; case 'user_event': {
				let user = maplist.user[~ref_id]
				if (user) {
					StatusDisplay.update_user(user) // messy...
					if (ref_id==Req.uid)
						View.update_my_user(user)
				}
			} }
		}
		// group messages to process more efficiently
		//  note: do we ever even get more than one at a time?
		//  well, after a disconnect, i guess
		if (comments.length) {
			// todo: we want the sidebar and chat to use the same
			// animationframe callback, so they are synced, if possible
			ChatView.scroll_lock(true)
			Sidebar.scroller.lock()
			
			ChatView.handle_messages(comments)
			Sidebar.display_messages(comments, false)
			Act.handle_messages(comments, listmapmap.message_event)
			View.comment_notification(comments)
			let ev = new CustomEvent('got_comments', {
				detail: {comments},
			})
			document.dispatchEvent(ev)
			
			ChatView.scroll_lock(false)
			Sidebar.scroller.unlock()
		}
	},
	init() {
		document.addEventListener('visibilitychange', e=>this.maybe_reconnect(e))
		window.addEventListener('pageshow', e=>this.maybe_reconnect(e))
		window.addEventListener('focus', e=>this.maybe_reconnect(e))
		window.addEventListener('online', e=>this.start_websocket(true))
	},
})

/*
idea: when socket dies, if page isn't visible, we do nothing
(otherwise, try restarting right away)
then, when page becomes visible, start socket if it's dead.
if socket is alive on visiblechange, but it's been a while since the last message or visiblechange, just kill and restart it, or maybe send a ping idk.

also, some http requests are expected to produce a websocket response.
so, if we don't get one, then something is up
*/

/*
websocket state indication
1: dead (nothing is happening)
2: starting (socket has been created, hasn't opened yet)
3: open (normal)

*/

Settings.add({
	name: 'socket_debug',
	label: "socket debug messages",
	type: 'select',
	options: ['no', 'yes'],
})
