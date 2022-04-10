class ApiSocket {
	constructor() {
		this.requests = {}
		this.ready = false
		this.last_id = ""
		this.processed_listeners = {}
		this.request_id = 1
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
			for (let i in this.requests)
				this.send(this.requests[i].data)
			this.ready = true
		}
		this.websocket.onclose = (e)=>{
			this.ready = false
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
		data = {type:'request', data, id:this.request_id++}
		this.requests[data.id] = {data, callback}
		if (this.ready)
			this.send(data)
		return {id: data.id}
	}
	cancel({id}) {
		delete this.requests[id]
	}
	handle_response({type, id, data:body, error}) {
		let request
		if (id) {
			request = this.requests[id]
			delete this.requests[id]
			if (!request)
				console.warn("got response without callback! id:"+id)
		}
		if (error) {
			console.error("error from", request, "\n→", error)
			throw new Error("invalid websocket request!")
		}
		let entitys = body.data
		if (type=='live') {
			this.last_id = body.lastId
			if (entitys.message)
				Entity.process(entitys.message)
			if (entitys.activity)
				Entity.process(entitys.activity)
			this.process_live(body.events, entitys)
		} else if (type=='userlistupdate') {
			Entity.process(entitys)
		} else if (type=='request') {
			Entity.process(entitys)
			if (request)
				request.callback(entitys)
		}
	}
	process_live(events, entitys) {
		for (let {refId, type, action, userId, date, id} of events) {
			let elistmap = entitys[type]
			switch (type) {
			case 'message':
				let m = elistmap.message["-"+refId]
				Sidebar.display_messages([m])
				ChatRoom.display_messages([m])
			}
		}
	}
}

// entity types:
// entity
// elist - list of entity
// elistmap - map of type -> elist
// elistmapmap - map of type -> elist

let Lp = new ApiSocket()

/*let Lp = 𖹭()
with(Lp)~function(){"use strict";𖹭={
	// interfacing with other systems
	on_listeners(map) {
		do_when_ready(()=>{
			ChatRoom.update_userlists(map)
		})
	},
	on_data({comment, commentdelete, activity, content, watch}) {
		do_when_ready(()=>{
			function comments(c) {
				if (c) {
					ChatRoom.display_messages(c)
					// URGENT TODO: this needs to run
					// AFTER AFTER AFTER the initial sidebar messages are shown
					Sidebar.display_messages(c)
				}
			}
			comments(comment)
			comments(commentdelete)
			
			//todo: properly link activity with contents?
			// todo: do we want to pass commentdelete here?
			Act.process_stuff(activity, comment, watch, content)
			
			if (activity)
				for (let a of activity)
					if (a.type == 'user') {
						if (a.content.id == Req.uid)
							View.update_my_user(a.content)
						ChatRoom.update_avatar(a.content)
					}
		})
	},
	
	// this is used in the userlist
	processed_listeners: {},
	// debug
	ws_message: {},
	//gotMessages: [],
	
	///////////////////////
	// PRIVATE variables //
	///////////////////////
	
	// stuff which is sent in requests
	lastId: 0,
	statuses: {'-1':"online"},
	lastListeners: {'-1':{'0':""}}, // this MUST be something which causes the request to complete instantly
	listening: [-1], // lastListeners is set based on this
	
	// websocket exclusive
	websocket: null,
	last_open: 0,
	dead: false,
	ws_is_ready: false,
	
	////////////////////
	// public methods //
	////////////////////
	
	start() {
		refresh()
	},
	
	stop() {
		websocket && websocket.close()
	},
	
	// todo: this gets set after the first request is made
	// meaning, our first response has listeners for -1, and immediately afterwards we get one with the real listeners
	// ideally, we should know which page is being viewed before the first request
	// ids: list of ids
	set_listening(ids) {
		listening = ids
	},
	
	// statuses: map of page-id -> status string
	set_statuses(stats) {
		statuses = stats
	},
	
	/////////////////////////
	// "private" functions //
	/////////////////////////
}}
*/
