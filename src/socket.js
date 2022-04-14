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
/*		;['online','offline','focus','blur'].forEach(x=>{
			window.addEventListener('online', e=>
		})*/
		/*window.addEventListener('online', e=>{
			this.dead = true
		})*/
		//		this.processed_listeners = {}
	set_listening(){},
	set_statuses(){},
	refresh(){},
	start_websocket() {
		if (this.websocket && this.websocket.readyState <= WebSocket.OPEN)
			throw new Error("Tried to open multiple websockets")
		
		this.websocket = new WebSocket(`wss://${Req.server}/live/ws?lastId=${this.last_id}&token=${encodeURIComponent(Req.auth)}`)
		this.websocket.onopen = (e)=>{
			console.log("🌄 websocket open")
			for (let i in this.handlers)
				this.send(this.handlers[i].request)
			this.ready = true
		}
		this.websocket.onclose = (event)=>{
			this.ready = false
			if (this.dead)
				return
			let {code, reason, wasClean} = event
			console.warn("websocket closed", code, reason, wasClean)
			alert('websocket died,,'+reason)
			//this.make_websocket()
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
		switch (response.type) { default: {
			console.warn("unknown response type: ", response)
		} break;case 'ping': {
			if (handler)
				handler.callback(response)
		} break;case 'lastId': {
			this.last_id = response.data
		} break;case 'live': {
			let {objects:entitys, events, lastId} = response.data
			this.last_id = response.lastId
			Entity.do_listmapmap(entitys)
			this.process_live(events, entitys)
		} break;case 'userlistupdate': {
			let entitys = response.data.objects
			Entity.do_listmap(entitys)
			// todo
		} break;case 'request': {
			let entitys = response.data.objects
			Entity.do_listmap(entitys)
			if (handler)
				handler.callback(entitys)
		}}
	},
	process_live(events, entitys) {
		let comments = []
		for (let {refId, type, action, userId, date, id} of events) {
			switch (type) { default: {
				console.warn("unknown event type:", type, events)
			} break; case 'message_event': {
				let message = entitys.message_event.message[~refId]
				comments.push(message)
			} break; case 'user_event': {
				let user = entitys.user_event.user[~refId]
				ChatRoom.update_avatar(user)
			}}
		}
		if (comments.length) {
			Act.process_messages(comments, entitys.message_event)
			Sidebar.display_messages(comments)
			ChatRoom.display_messages(comments)
			Act.redraw()
		}
	},
}

window.addEventListener('beforeunload', e=>{
	Lp.dead = true
})
