// websocket states
// 1: normal
//   - if we have lastid, start doing requests, otherwise wait
// 3: dead
//   - do nothing, page is about to reload
// 4: waiting for token or onopen
//   - if the wsauth request finishes
//     - failed: fatal (remember we have autorerequest at a lower level)
//     - suceeded: set wsauth, go to state 1 if socket is open
//   - if the socket opens
//     - go to state 1 if wsauth has been recieved

// in state 1 and 4, if the socket closes:
///  (we want to have some rate limiting here, in case we have lost connection)
//  - reopen it
//  - if there was a token error (only possible in state 1)
//    - wsauth = null
//    - request wsauth
//  - go to state 4

let Lp = Object.create(null)
with(Lp)((window)=>{"use strict";Object.assign(Lp,{
	
	// interfacing with other systems
	on_listeners(map) {
		View.do_when_ready(()=>{
			ChatRoom.update_userlists(map)
		})
	},
	on_data({comment, commentdelete, activity, content}) {
		View.do_when_ready(()=>{
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
			Act.process_stuff(activity, comment, content)
			
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
	
	use_websocket: false,
	
	// websocket exclusive
	websocket: null,
	ws_token: null,
	last_open: 0,
	dead: false,
	ws_is_ready: false,
	// long poller exclusive
	lp_cancel: ()=>{},
	running: false,
	
	////////////////////
	// public methods //
	////////////////////
	
	start() {
		refresh()
		if (use_websocket) {
			print('starting lp: websocket')
			ws_refresh()
		} else {
			if (!running) {
				print('starting lp: long poller')
				lp_loop()
			}
		}
	},
	
	stop() {
		if (use_websocket) {
			websocket && websocket.close()
		} else {
			lp_cancel()
		}
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
	
	// call this after setting the parameters
	refresh() {
		if (use_websocket) {
			ws_refresh()
		} else {
			lp_cancel()
			lp_loop()
		}
	},
	
	/////////////////////////
	// "private" functions //
	/////////////////////////
	
	// output is in websocket format
	make_request() {
		let new_listeners = {}
		for (let id of listening)
			new_listeners[id] = lastListeners[id] || {'0':""}
		
		if (!lastId)
			alert("missing lastid!")
		
		let actions = {
			lastId: lastId, // todo: make sure this is ALWAYS set (not 0) except for the initial request where we get lastid
			statuses: statuses,
			chains: [ // 0
				'comment.0id',
				'activity.0id-{"includeAnonymous":true}',
				'watch.0id', //new stuff //changed
				'content.1parentId.2contentId.3contentId', //pages
				'user.1createUserId.2userId.1editUserId.2contentId', //users for comment and activity
				'category.2contentId', //todo: handle values returned by this
			]
		}
		let listeners = {
			lastListeners: new_listeners,
			chains: [
				'user.0listeners',
			]
		}
		
		return {
			actions: actions,
			listeners: listeners,
			fields: {content:['id','createUserId','name','permissions','type']},
		}
	},
	
	ws_refresh() {
		ws_message = make_request()
		if (ws_is_ready)
			websocket_flush()
	},
	
	lp_listen() {
		let {actions, listeners, fields} = make_request()
		// convert make_request output to long poller format
		let query = {
			actions: JSON.stringify(actions),
			listeners: JSON.stringify(listeners),
		}
		for (let [key, value] of Object.entries(fields))
			query[key] = value.join(",")
		
		return Req.request3("Read/listen"+Req.query_string(query))
	},
	
	// if
	lp_loop() {
		running = true
		//make sure only one instance of this is running
		let cancelled
		let x = lp_listen()
		
		x((resp)=>{
			if (cancelled) {
				// should never happen (but I think it does sometimes..)
				console.log("OH HECK, request called callback after being cancelled?")
				return
			}
			process(resp)
			lp_loop()
		}, (e, resp)=>{
			running = false
			console.log("LONG POLLER FAILED", e, resp)
			print("LONG POLLER FAILED:"+resp)
			alert("LONG POLLER FAILED:"+resp)
		})
		
		lp_cancel = ()=>{
			cancelled = true
			running = false
			x.abort()
		}
	},
	
	update_lastid(id) {
		id = +id
		if (id) {
			lastId = id
		}
	},
	
	process(resp) {
		// try/catch here so the long poller won't fail when there's an error in the callbacks
		try {
			// most important stuff:
			if (resp.lastId)
				update_lastid(resp.lastId)
			if (resp.listeners)
				lastListeners = resp.listeners
			
			let c = resp.chains // this SHOULD always be set, yeah?
			c && Entity.process(c)
			
			if (resp.listeners) {
				// process listeners (convert uids to user objetcs) (also makes a copy)
				// shouldn't this be handled by Entity?
				let out = {}
				Object.for(resp.listeners, (list, id)=>{
					out[id] = {}
					Object.for(list, (status, uid)=>{
						out[id][uid] = {user: c.user_map[uid], status: status}
					})
				})
				processed_listeners = out
				on_listeners(out)
			}
			
			c && on_data(c)
		} catch (e) {
			error("error processing lp/ws response: ", e)
		}
	},
	
	websocket_flush() {
		if (!ws_is_ready)
			return
		// this check should never fail
		if (!ws_is_open() || !ws_token) {
			print("websocket flush sequence error!")
			console.error("websocket flush sequence error!")
			return
		}
		if (ws_message.listeners) {
			ws_message.auth = ws_token
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
	do_early() {
		if (use_websocket) {
			get_ws_auth()
			open_websocket()
		}
	},
	
	// to be ready to use, we must have
	// - the ws auth token
	// - an opened websocket
	// once both of these are fulfilled, ws_ready() is called
	
	get_ws_auth() {
		Req.request2('Read/wsauth').then((resp)=>{
			ws_token = resp
			if (ws_is_open())
				ws_ready()
		}, (e, resp)=>{
			print('websocket auth failed:'+e)
		})
	},

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
		
		websocket = new WebSocket(`wss://${Req.server}/read/wslisten`)
		
		websocket.onopen = (e)=>{
			print("websocket open!")
			if (ws_token)
				ws_ready()
		}
		websocket.onerror = (e)=>{
			print("websocket error!")
		}
		websocket.onclose = (e)=>{
			console.log("websocket closed:", e.code, e.reason, e.wasClean)
			print("websocket close!")
			
			if (dead)
				return
			// 1000, "Invalid token", true - token
			// 1006, "", false - connection error
			ws_is_ready = false
			
			if (e.reason=="Invalid token") {
				ws_token = null
				get_ws_auth()
			}
			open_websocket()
		}
		websocket.onmessage = (e)=>{
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
	
})<!-- PRIVATE })



0<!-- Lp ({
})(window)
Object.seal(Lp)
