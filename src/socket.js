'use strict'
// todo: if we're disconnected for a long time, we might lose sync
// so, at that point there's really no way to recover (also we need to re-request our user object in case it updated)

class SocketRequestError extends TypeError {
	constructor(resp, extra) {
		super()
		this.trim_stack(1)
		this.resp = resp
		this.message = "\n"+resp.error
	}
}
SocketRequestError.prototype.name = "SocketRequestError"

let Lp = singleton({
	handlers: new Map(),
	handler_id: 1,
	ready: false,
	last_id: "",
	no_restart: false,
	expected_close: false,
	websocket: null,
	got_error: false,
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
/*		;['online','offline','focus','blur'].forEach(x=>{
			window.addEventListener('online', e=>
		})*/
		/*window.addEventListener('online', e=>{
			this.dead = true
		})*/
	//		this.processed_listeners = {}
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
			this.expected_close = false
			this.websocket.close()
			this.websocket = null
		}
	},
	is_alive() {
		return this.websocket && this.websocket.readyState <= WebSocket.OPEN
	},
	start_websocket(force) {
		if (this.no_restart)
			return
		if (!force && this.is_alive())
			throw new Error("Tried to open multiple websockets")
		this.kill_websocket()
		print('starting websocket...')
		this.got_error = false
		this.websocket = new WebSocket(`wss://${Req.server}/live/ws?lastId=${this.last_id}&token=${encodeURIComponent(Req.auth)}`)
		this.state_change('opening')
		
		this.websocket.onopen = (e)=>{
			this.state_change('open')
			console.log("🌄 websocket open")
			this.on_ready()
		}
		
		this.websocket.onerror = (e)=>{
			console.warn("websocket error")
			print("📶 websocket connection error")
			this.got_error = true
		}
		
		this.websocket.onclose = ({code, reason, wasClean})=>{
			console.log("ws closed", code, reason, wasClean)
			this.ready = false
			this.state_change('dead')
			let restart = true
			if (this.no_restart)
				restart = false
			if (this.got_error) // network error
				restart = false
			if (!this.expected_close) {
				if ('visible'!=document.visibilityState)
					restart = false
			}
			this.expected_close = false
			// we use timeout to avoid recursion and leaking stack traces
			if (restart) {
				this.state_change('opening')
				window.setTimeout(()=>this.start_websocket())
			}
		}
		
		this.websocket.onmessage = ({origin, data, target})=>{
			if (target !== this.websocket) {
				alert("websocket wrong event target? multiple sockets still open?")
				return
			}
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
			this.expected_close = true
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
			ChatRoom.update_userlists(data.statuses, data.objects)
		} break;case 'badtoken': {
			//
		} }
		
	},
	process_live(events, entitys) {
		let comments = []
		Entity.ascending(events)
		//events.sort((a,b)=>a.id-b.id)
		let prev_id = -Infinity
		for (let {refId, type, action, userId, date, id} of events) {
			if (id < prev_id) {
				alert("event ids out of order! please report this")
				print(JSON.stringify(events))
				console.warn(events)
			}
			prev_id = id
			let maplist = entitys[type]
			switch (type) { default: {
				console.warn("unknown event type:", type, events)
			} break; case 'message_event': {
				let message = maplist.message[~refId]
				if (message) {
					Act.message(message, maplist)
					comments.push(message)
				}
			} break; case 'user_event': {
				let user = maplist.user[~refId]
				if (user) {
					ChatRoom.update_avatar(user) // messy...
					if (refId==Req.uid)
						View.update_my_user(user)
				}
			} }
		}
		if (comments.length) {
			Sidebar.display_messages(comments)
			ChatRoom.display_messages(comments)
		}
	},
	init() {
		window.addEventListener('beforeunload', e=>{
			this.no_restart = true
		})
		
		document.addEventListener('visibilitychange', e=>{
			if ('visible'==document.visibilityState) {
				window.setTimeout(()=>{
					if (navigator.onLine) {
						if (this.is_alive()) {
							this.ping(()=>{})
						} else
							this.start_websocket()
					}
				}, 100)
			}
		})
		
		window.addEventListener('online', e=>{
			print('online')
			this.start_websocket(true)
		})
	},
})

function online_and_visible() {
	return navigator.onLine && document.visibilityState == 'visible'
}

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

