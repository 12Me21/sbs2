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

class ApiSocket {
	constructor() {
		this.handlers = {}
		this.handler_id = 1
		this.ready = false
		this.last_id = ""
		this.dead = false
		window.addEventListener('beforeunload', e=>{
			this.dead = true
		})
//		this.processed_listeners = {}
	}
	set_listening(){}
	set_statuses(){}
	refresh(){}
	start_websocket() {
		if (this.websocket && this.websocket.readyState <= WebSocket.OPEN)
			throw new Error("Tried to open multiple websockets")
		
		this.websocket = new WebSocket(`wss://${Req.server}/live/ws?lastId=${this.last_id}&token=${encodeURIComponent(Req.auth)}`)
		this.websocket.onopen = (e)=>{
			console.log("🌄 websocket open")
			for (let i in this.handlers)
				this.send(this.handlers[i].data)
			this.ready = true
		}
		this.websocket.onclose = (e)=>{
			this.ready = false
			if (this.dead)
				return
			alert('websocket died,,')
			//this.make_websocket()
		}
		this.websocket.onmessage = (event)=>{
			this.handle_response(JSON.parse(event.data))
		}
	}
	send(data) {
		this.websocket.send(JSON.stringify(data))
	}
	chain(data, callback=console.info) {
		data = {type:'request', data, id:this.handler_id++}
		this.handlers[data.id] = {data, callback}
		if (this.ready)
			this.send(data)
		return {id: data.id}
	}
	cancel({id}) {
		delete this.handlers[id]
	}
	handle_response(response) {
		let handler
		if (response.id) {
			handler = this.handlers[response.id]
			delete this.handlers[response.id]
			if (!handler)
				console.warn("got response without callback! id:"+response)
		}
		
		if (response.error) {
			let x = SELF_DESTRUCT(SocketRequestError, response)
			if (handler)
				handler.callback(x)
			x.throw
			return
		}
		
		switch (response.type) { default: {
			console.warn("unhandled response: ", response)
		} break;case 'lastId': {
			this.last_id = response.data
		} break;case 'live': {
			let {objects:entitys, events, lastId} = response.data
			this.last_id = response.lastId
			Entity.do_listmapmap(entitys)
			this.process_live(events, entitys)
		} break;case 'userlistupdate': {
			let {objects:entitys} = response.data
			Entity.do_listmap(entitys)
			// todo:
		} break;case 'request': {
			let {objects:entitys} = response.data
			Entity.do_listmap(entitys)
			if (handler)
				handler.callback(entitys)
		}}
	}
	process_live(events, entitys) {
		let comments = []
		for (let {refId, type, action, userId, date, id} of events) {
			switch (type) { default: {
				console.warn("unhandled event: ", type, events)
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
	}
}

let Lp = new ApiSocket()
