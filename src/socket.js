let Lp = 𖹭()
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
	
	// output is in websocket format
	make_request() {
		let x = {
			type: 'request',
			data: {
				'values': {
					pid: 937,
					yesterday: "2022-04-03 20",
				},
				requests: [{
					type: 'message_aggregate',
					fields: "contentId,count,maxId,minId,createUserId,maxCreateDate",
					query: "createDate > @yesterday",
					order: '',
					limit: 1000,
					skip: 0,
				},{
					type: 'content',
					fields: 'id, name, permissions',
					query: "id = @pid or id in @message_aggregate.contentId",
					order: '',
					limit: 1000,
					skip: 0,
				},{
					type: 'message',
					fields: '*',
					query: "contentId = @pid and !notdeleted()",
					order: 'id_desc',
					limit: 30,
					skip: 0,
				},{
					type: 'user',
					fields: '*',
					query: "id in @message.createUserId or id in @message.uidsInText",
					order: '',
					limit: 1000,
					skip: 0,
				}],
			},
			id: '9718812705010064',
		}
		return x
		
		let new_listeners = {}
		for (let id of listening)
			new_listeners[id] = lastListeners[id] || {'0':""}
		
		if (!lastId)
			alert("missing lastid!")
		
	},
	
	refresh() {
		ws_message = make_request()
		if (ws_is_ready)
			websocket_flush()
	},
	
	update_lastid(id) {
		id = +id
		if (id) {
			lastId = id
		}
	},
	
	process(resp) {
		if (resp.type=='request') {
			let data = resp.data.data
			Entity.process(data)
			//on_data(data)
		} else if (resp.type=='live') {
			let data = resp.data.data.message
			Entity.process(data)
			on_data(data)
		}
	},
	
	websocket_flush() {
		if (!ws_is_ready)
			return
		// this check should never fail
		if (!ws_is_open()) {
			print("websocket flush sequence error!")
			console.error("websocket flush sequence error!")
			return
		}
		if (ws_message.listeners) {
			websocket.send(JSON.stringify(ws_message))
		}
	},
	// call this when websocket is ready (have auth and opened)
	ws_ready() {
		ws_is_ready = true
		websocket_flush()
	},
	// if open
	ws_is_open() {
		return websocket && websocket.readyState==WebSocket.OPEN
	},
	// init
	start() {
		open_websocket()
	},
	
	// to be ready to use, we must have
	// - the ws auth token
	// - an opened websocket
	// once both of these are fulfilled, ws_ready() is called
	
	open_websocket() {
		if (websocket && websocket.readyState <= WebSocket.OPEN) {
			print("multiple websocket tried to open!")
			console.error("multiple websocket tried to open!")
			// should not happen!
			return
		}
		
		let now = Date.now()
		if (now - last_open < 4000) {
			print("websocket loop too fast! delaying 5 seconds.\nThis is probably caused by an invalid websocket token. please report this")
			setTimeout(open_websocket, 5000)
			return
		}
		last_open = now
		
		websocket = new WebSocket(`wss://${Req.server}/live/ws?token=${Req.auth}`)
		
		websocket.onopen = (e)=>{
			print("websocket open!")
			ws_ready()
		}
		websocket.onerror = (e)=>{
			print("websocket error!")
		}
		websocket.onclose = (e)=>{
			if (dead)
				return
			
			print("websocket closed: "+e.reason)
			// 1000, "Invalid token", true - token
			// 1006, "", false - connection error
			ws_is_ready = false
			
			//todo: if we get a connection error after a long time (ex: after exiting sleep mode) then the auth token might be invalid too. we should check how long it has been since the token was generated
			// and maybe also auto-rerequest the token when its about to expire too.
			
			open_websocket()
		}
		websocket.onmessage = (e)=>{
			let data = JSON.safe_parse(e.data)
			if (!data)
				return
			
			
			
			let msg = String(e.data) // will e.data always be a string?
			let [match, type] = /^(\w+):/.rmatch(msg)
			if (!match) {
				let resp = JSON.safe_parse(msg)
				if (resp !== undefined) {
					process(resp)
					return
				}
			} else if (type=='accepted') {
				return //print("websocket accepted")
			} else if (type=='error') {
				if (!/^error:System.InvalidOperationException: Invalid token/.test(msg))
					print("websocket error:", msg)
				return
			}
			print("websocket unknown message:", msg)
		}
	},
	
}}()
