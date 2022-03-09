// it's very important that the first long poll request finishes instantly
// we normally ensure this by having lpLastListeners always have at least one room set but this can be accidentally broken very easily and it's a mess
// need a more consistent way to update lastlisteners PLEASE

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
			Act.process_stuff(activity, comment, null, content)
			
			// I dont think user edits are broadcast anymore, but
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
	
	// status
	running: false,
	// websocket exclusive
	use_websocket: false,
	websocket: null,
	ws_token: null,
	last_open: 0,
	// long poller exclusive
	lp_cancel: ()=>{},
	
	////////////////////
	// public methods //
	////////////////////
	
	start() {
		if (!running) {
			if (use_websocket) {
				print('starting lp: websocket')
				ws_refresh(true)
			} else {
				print('starting lp: long poller')
				lp_loop(true)
			}
		}
	},
	
	stop() {
		if (use_websocket) {
			websocket && websocket.close()
		} else {
			lp_cancel()
		}
		running = false
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
		if (running) {
			if (use_websocket) {
				ws_refresh()
			} else {
				lp_cancel()
				lp_loop()
			}
		} else {
			console.log("ws refresh fail, too early")
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
			chains: [
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
		running = true
		ws_message = make_request()
		websocket_flush()
	},
	
	lp_listen(callback) {
		let {actions, listeners, fields} = make_request()
		// convert make_request output to long poller format
		let query = {
			actions: JSON.stringify(actions),
			listeners: JSON.stringify(listeners),
		}
		for (let [key, value] of Object.entries(fields))
			query[key] = value.join(",")
		
		return Req.request("Read/listen"+Req.query_string(query), 'GET', callback)
	},
	
	// if
	lp_loop() {
		running = true
		//make sure only one instance of this is running
		let cancelled
		let x = lp_listen((e, resp)=>{
			if (cancelled) { // should never happen (but I think it does sometimes..)
				console.log("OH HECK, request called callback after being cancelled?")
				//return //removing this for consistency since websocket doesn't have cancelling
			}
			process(e, resp)
			if (!e) {
				// I'm not sure this is needed. might be able to just call lp_loop diretcly?
				let t = window.setTimeout(()=>{
					if (cancelled) // should never happen?
						return
					lp_loop()
				}, 0)
				lp_cancel = ()=>{
					cancelled = true
					running = false
					window.clearTimeout(t)
				}
			}
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
	
	process(e, resp) {
		if (e) {
			alert("LONG POLLER FAILED:"+resp)
			console.log("LONG POLLER FAILED", e, resp)
			return
		}
		
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
		if (!running)
			return // hack idk
		if (websocket && websocket.readyState == 0) {
			return
		} else if (websocket && websocket.readyState == 1) {
			if (ws_token) {
				if (ws_message.listeners) {
					ws_message.auth = ws_token
					websocket.send(JSON.stringify(ws_message))
				}
			}
		} else {
			open_websocket()
		}
	},
	
	do_early() {
		if (use_websocket) {
			open_websocket()
		}
	},
	
	get_ws_auth(callback) {
		Req.request("Read/wsauth", 'GET', (e, resp)=>{
			if (!e) {
				ws_token = resp
				print("got ws token!")
				callback()
			} else {
				print('websocket auth failed:'+e)
			}
		})
	},
	
	open_websocket() {
		if (websocket && websocket.readyState<2) {
			print('multiple websocket tried to open!')
			return;
		}
		let now = Date.now()
		if (now - last_open < 4000) {
			print('websocket loop too fast! delaying 5 seconds.\nThis is probably caused by an invalid websocket token. please report this')
			setTimeout(open_websocket, 5000);
			return;
		}
		last_open = now
		ws_token = null
		// todo: we don't know whether the websocket will open before or after the auth token is gotten.
		// make sure we don't flush twice.
		get_ws_auth(()=>{
			websocket_flush()
		})
		websocket = new WebSocket("wss://"+Req.server+"/read/wslisten")
		
		websocket.onopen = (e)=>{
			print("websocket open!")
			websocket_flush()
		}
		websocket.onerror = (e)=>{
			window.ee = e // what are u?
			console.log(e)
			if (!String(e).startsWith("System.InvalidOperationException: Invalid token"))
				print("websocket error!"+e)
		}
		websocket.onclose = (e)=>{
			print("websocket close!")
			open_websocket()
		}
		websocket.onmessage = (e)=>{
			let match = String(e.data).match(/^(\w+):/)
			if (!match) {
				let resp
				try {
					resp = JSON.parse(e.data)
				} catch (e) {
					print("mystery websocket message:"+e.data)
					return
				}
				
				process(null, resp)
			} else if (match[1]=="accepted") {
				//print("websocket accepted")
			} else if (match[1]=="error") {
				print("websocket error: "+e.data)
			} else {
				print("websocket unknown message: "+e.data)
			}
		}
	},
	
})<!-- PRIVATE })



0<!-- Lp ({
})(window)
Object.seal(Lp)
