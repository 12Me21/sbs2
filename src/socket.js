class ApiSocket {
	constructor() {
		this.requests = {}
		this.ready = false
		this.last_id = -1
		this.processed_listeners = {}
	}
	set_listening(){}
	set_statuses(){}
	refresh(){}
	start_websocket() {
		if (this.websocket && websocket.readyState <= WebSocket.OPEN)
			throw new Error("Tried to open multiple websockets")
		
		this.websocket = new WebSocket(`wss://${Req.server}/live/ws?lastId=${this.last_id}&token=${encodeURIComponent(Req.auth)}`)
		this.websocket.onopen = (e)=>{
			for (let i in this.requests)
				this.websocket.send(this.requests[i].data)
			this.ready = true
		}
		this.websocket.onclose = (e)=>{
			this.ready = false
			alert('websocket died,,')
			//this.make_websocket()
		}
		this.websocket.onmessage = (event)=>{
			this.process(JSON.parse(event.data))
		}
	}
	request(data, callback) {
		data = JSON.stringify(data)
		this.requests[data.id] = {data, callback}
		if (this.ready)
			this.websocket.send(data)
	}
	process(data) {
		if (data.type=='live')
			this.process_live(data)
		else if (data.type=='userlistupdate')
			;
		if (data.id) {
			let req = this.requests[data.id]
			delete this.requests[data.id]
			if (!req)
				throw new Error("got response without callback! id:"+data.id)
			req.callback(data)
		}
	}
	process_live(data) {
		this.last_id = data.data.lastId
		let ddd = data.data.data
		if (ddd.message)
			Entity.process(ddd.message)
		if (ddd.activity)
			Entity.process(ddd.activity)
		for (let {refId, type, action, userId, date, id} of data.data.events) {
			let list = ddd[type][type] // todo: process these lists into maps
			switch (type) {
			case 'message':
				Sidebar.display_messages([list["-"+idref]])
			}
		}
		
		console.log('message', ddd)
	}
}

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
