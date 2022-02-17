let Lp = Object.create(null)
with(Lp)((window)=>{"use strict";Object.assign(Lp,{
	
	// external
	on_listeners: null,
	on_messages: null,
	on_activity: null,
	on_start: null,
	
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
	init: true, // waiting for initial response
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
	
	start(ws) {
		if (!running) {
			use_websocket = ws
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
		if (running && !init) {
			if (use_websocket) {
				ws_refresh()
			} else {
				lp_cancel()
				lp_loop()
			}
		}
	},
	
	/////////////////////////
	// "private" functions //
	/////////////////////////
	
	// output is in websocket format
	make_request(get_me) {
		let new_listeners = {}
		listening.forEach((id)=>{
			new_listeners[id] = lastListeners[id] || {'0':""}
		})
		
		let actions = {
			lastId: lastId,
			statuses: statuses,
			chains: [
				'comment.0id',
				"activity.0id-"+JSON.stringify({includeAnonymous:true}),
				'watch.0id', //new stuff //changed
				'content.1parentId.2contentId.3contentId', //pages
				'user.1createUserId.2userId.1editUserId.2contentId', //users for comment and activity
				'category.2contentId' //todo: handle values returned by this
			]
		}
		let listeners = {
			lastListeners: new_listeners,
			chains: [
				'user.0listeners'
			]
		}
		if (get_me) {
			// TODO: make sure lastListeners is something that will never occur so you'll always get the update
			listeners.chains.push(
				"user~Ume-"+JSON.stringify({ids:[Req.uid],limit:1})
			)
		}
		
		return {
			actions: actions,
			listeners: listeners,
			fields: {content:['id','createUserId','name','permissions','type']},
		}
	},
	
	ws_refresh(get_me) {
		running = true
		ws_message = make_request(get_me)
		websocket_flush()
	},
	
	lp_listen(get_me, callback) {
		let requests = make_request(get_me)
		// convert make_request output to long poller format
		let query = {
			actions: JSON.stringify(requests.actions),
			listeners: JSON.stringify(requests.listeners),
		}
		for (let [key, value] of Object.entries(requests.fields))
			query[key] = value.join(",")
		
		return Req.request("Read/listen"+Req.queryString(query), 'GET', callback)
	},
	
	// if
	lp_loop(get_me) {
		running = true
		//make sure only one instance of this is running
		let cancelled
		let x = lp_listen(get_me, (e, resp)=>{
			if (cancelled) { // should never happen (but I think it does sometimes..)
				console.log("OH HECK, request called callback after being cancelled?")
				//return //removing this for consistency since websocket doesn't have cancelling
			}
			process(e, resp)
			if (!e) {
				// I'm not sure this is needed. might be able to just call lp_loop diretcly?
				let t = setTimeout(()=>{
					if (cancelled) // should never happen?
						return
					lp_loop()
				}, 0)
				lp_cancel = ()=>{
					cancelled = true
					running = false
					clearTimeout(t)
				}
			}
		})
		lp_cancel = ()=>{
			cancelled = true
			running = false
			x.abort()
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
			lastId = resp.lastId
			if (resp.listeners)
				lastListeners = resp.listeners
			
			let c = resp.chains // this SHOULD always be set, yeah?
			Entity.process(c)
			
			let me = c.Ume
			
			if (init || me) {
				print("got initial lp response!")
				init = false
				if (me && me[0]) {
					on_start(me[0])
				} else {
					alert("lp sequence error!!!")
					// what this means:
					// the first websocket/longpoll response is ALWAYS supposed to contain your own user data
					// if not, it means that something went very wrong
					console.error("couldn't get your user in initial lp request")
				}
				if (use_websocket)
					ws_refresh(); // not always necessary, depends on timing (is this true?)
			}
			//console.log('keeping data: ', resp)
			
			if (resp.listeners) {
				let out = {}
				// process listeners (convert uids to user objetcs) (also makes a copy)
				// shouldn't this be handled by Entity?
				Object.for(resp.listeners, (list, id)=>{
					out[id] = {}
					Object.for(list, (status, uid)=>{
						out[id][uid] = {user: c.userMap[uid], status: status}
					})
				})
				processed_listeners = out
				on_listeners(out)
			}
			// todo: <debug missing comments here>
			if (c.comment)
				on_messages(c.comment, c.content)
			if (c.commentdelete)
				on_messages(c.commentdelete)
			if (c.activity)
				on_activity(c.activity, c.content)
		} catch (e) {
			console.error("error processing lp/ws response: ", e)
		}
	},
	
	websocket_flush() {
		if (websocket && websocket.readyState == 0)
			return;
		else if (websocket && websocket.readyState == 1) {
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
	
	// todo: we need to be 100% sure that the initial websocket config is NEVER changed until the ws returns initially, I think
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
		websocket = new WebSocket("wss://"+Req.server+"/read/wslisten")
		// todo: we don't know whether the websocket will open before or after the auth token is gotten.
		// make sure we don't flush twice.
		Req.request("Read/wsauth", 'GET', (e, resp)=>{
			if (!e) {
				ws_token = resp
				print("got ws token!")
				websocket_flush()
				//this.ws_refresh(callback)
			} else {
				print('websocket auth failed:'+e)
			}
		})
		websocket.onopen = (e)=>{
			print("websocket open!")
			websocket_flush()
		}
		websocket.onerror = (e)=>{
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
