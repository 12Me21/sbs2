// todo: if we're disconnected for a long time, we might lose sync
// so, at that point there's really no way to recover (also we need to re-request our user object in case it updated)

// only call this through SELFDESTRUCT
class SocketRequestError extends TypeError {
	constructor(resp, extra) {
		super()
		this.trim_stack(2)
		this.resp = resp
		this.message = "\n"+resp.error
	}
}
SocketRequestError.prototype.name = "SocketRequestError"

let Lp = function() {"use strict"; return singleton({
	handlers: {},
	handler_id: 1,
	ready: false,
	last_id: "",
	no_restart: false,
	expected_close: false,
	websocket: null,
	state_change(state, ping) {
		// todo: here, we should graphically indicate the state somehow
		// as well as when pings are sent
		if (ping && document.documentElement.dataset.socketState!='ping')
			return
		document.documentElement.dataset.socketState = state
	},
	statuses: {},
	status_queue: {},
	set_status(id, s) {
		this.statuses[id] = s
		this.status_queue[id] = s
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
		for (let i in this.handlers)
			this.send(this.handlers[i].request)
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
		if (!force && this.is_alive())
			throw new Error("Tried to open multiple websockets")
		this.kill_websocket()
		print('starting websocket...')
		//`wss://${"w".repeat(10000)}:password@${Req.server}/live/ws?lastId=${this.last_id}&token=${encodeURIComponent(Req.auth)}`
		this.websocket = new WebSocket(`wss://${Req.server}/live/ws?lastId=${this.last_id}&token=${encodeURIComponent(Req.auth)}`/*, 'json'*/)
		this.state_change('opening')
		
		this.websocket.onopen = (e)=>{
			this.state_change('open')
			console.log("🌄 websocket open")
			this.on_ready()
		}
		
		this.websocket.onerror = (e)=>{
			console.warn('ws error')
		}
		
		this.websocket.onclose = ({code, reason, wasClean})=>{
			this.ready = false
			this.state_change('dead')
			print('websocket closed')
			let restart = true
			if (this.no_restart)
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
		this.handlers[request.id] = {request, callback}
		if (this.ready)
			this.send(request)
		return {id:request.id}
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
		let handler = this.handlers[id]
		delete this.handlers[id]
		return handler
	},
	handle_response(response) {
		if (response.type=='unexpected' && /ExpiredCheckpoint/.test(response.error)) {
			print("server restart, lastid reset?")
			this.last_id = 0
			this.expected_close = true
			return
		}
		
		let handler
		if (response.id) {
			handler = this.pop_handler(response.id)
			if (!handler)
				console.warn("got response without handler:", response)
		}
		if (response.error) {
			let x = SELF_DESTRUCT(SocketRequestError, response)
			if (handler && handler.request.type == response.type)
				handler.callback(x)
			x.throw
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
		}}
		
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
			}}
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
				if (this.is_alive()) {
					this.state_change('ping')
					this.ping(()=>{
						this.state_change('open', true)
					})
				} else
					this.start_websocket()
			}
		})
	},
})}()

Lp.init()

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

