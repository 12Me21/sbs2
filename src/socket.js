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

let Lp = {
	handlers: {},
	handler_id: 1,
	ready: false,
	last_id: "",
	dead: false,
	expected_close: false,
/*		;['online','offline','focus','blur'].forEach(x=>{
			window.addEventListener('online', e=>
		})*/
		/*window.addEventListener('online', e=>{
			this.dead = true
		})*/
		//		this.processed_listeners = {}
	start_websocket() {
		if (this.websocket && this.websocket.readyState <= WebSocket.OPEN)
			throw new Error("Tried to open multiple websockets")
		
		this.websocket = new WebSocket(`wss://${Req.server}/live/ws?lastId=${this.last_id}&token=${encodeURIComponent(Req.auth)}`/*, 'json'*/)
		
		this.websocket.onopen = (e)=>{
			console.log("🌄 websocket open")
			for (let i in this.handlers)
				this.send(this.handlers[i].request)
			this.ready = true
		}
		
		this.websocket.onclose = (event)=>{
			this.ready = false
			if (this.expected_close) {
				this.expected_close = false
				this.start_websocket()
				return
			}
			if (this.dead)
				return
			let {code, reason, wasClean} = event
			console.warn("websocket closed", code, reason, wasClean)
			let cont = window.confirm('websocket died,,'+reason+"\n[OK] - start")
			if (cont)
				this.start_websocket()
		}
		
		this.websocket.onmessage = (event)=>{
			this.handle_response(JSON.parse(event.data))
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
	
	set_status(stati, callback) {
		return this.request({type:'setuserstatus', data:stati}, callback)
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
			Entity.do_listmapmap(data.objects)
			this.process_live(data.events, data.objects)
		} break;case 'userlistupdate': {
			Entity.do_listmap(data.objects)
			ChatRoom.update_userlists(data.statuses, data.objects)
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
				Act.message(message, maplist)
				comments.push(message)
			} break; case 'user_event': {
				let user = maplist.user[~refId]
				ChatRoom.update_avatar(user)
			}}
		}
		if (comments.length) {
			Sidebar.display_messages(comments)
			ChatRoom.display_messages(comments)
		}
	},
}

window.addEventListener('beforeunload', e=>{
	Lp.dead = true
})

window.addEventListener('focus', e=>{
	if (Lp.ready)
		Lp.ping(()=>{})
})

window.addEventListener('pageshow', e=>{
	print('show')
})
