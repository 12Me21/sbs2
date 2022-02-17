let Lp = {
	// events
	onListeners(map) {
		ChatRoom.updateUserLists(map)
	},
	onMessages(comments, contents) {
		ChatRoom.displayMessages(comments)
		Act.newComments(comments, Entity.makePageMap(contents))
		Act.redraw()
		Sidebar.displayMessages(comments)
	},
	onActivity(a, p) { //todo: properly link activity with contents?
		a.forEach((a)=>{
			if (a.type == 'user')
				View.updateUserAvatar(a.content) //todo: also update your avatar in sidebar
		})
		Act.newActivity(a, Entity.makePageMap(p))
		Act.redraw()  //this might update unnecessarily often
	},
	onStart(resp) {
		let me = resp.chains.Ume
		if (me && me[0])
			View.updateMyUser(me[0]) //also sets Req.me...
		else {
			alert("lp sequence error!!!")
			// what this means:
			// the first websocket/longpoll response is ALWAYS supposed to contain your own user data
			// if not, it means that something went very wrong
			console.error("couldn't get your user in initial lp request")
		}
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
	lastListeners: {'-1':{'0':""}},
	
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
	
	start(use_websocket) {
		if (!this.running) {
			this.use_websocket = use_websocket
			if (use_websocket) {
				print('starting lp: websocket')
				this.ws_refresh(true)
			} else {
				print('starting lp: long poller')
				this.lp_loop(true)
			}
		}
	},
	
	stop() {
		if (this.use_websocket) {
			this.websocket && this.websocket.close()
		} else {
			this.lp_cancel()
		}
		this.running = false
	},
	
	// todo: this gets set after the first request is made
	// meaning, our first response has listeners for -1, and immediately afterwards we get one with the real listeners
	// ideally, we should know which page is being viewed before the first request
	// ids: list of ids
	set_listening(ids) {
		this.listening = ids
	},
	
	// statuses: map of page-id -> status string
	set_statuses(statuses) {
		this.statuses = statuses
	},
	
	// call this after setting the parameters
	refresh() {
		if (this.running && !this.init) {
			if (this.use_websocket) {
				this.ws_refresh()
			} else {
				this.lp_cancel()
				this.lp_loop()
			}
		}
	},
	
	/////////////////////////
	// "private" functions //
	/////////////////////////
	
	// output is in websocket format
	make_request(getMe) {
		let new_listeners = {}
		this.listening.forEach((id)=>{
			new_listeners[id] = this.lastListeners[id] || {'0':""}
		})
		
		let actions = {
			lastId: this.lastId,
			statuses: this.statuses,
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
		if (getMe) {
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
	
	ws_refresh(me) {
		this.running = true
		let req = this.make_request(me)
		this.ws_message = req
		this.websocket_flush()
	},
	
	lp_listen(getMe, callback) {
		let requests = this.make_request(getMe)
		// convert make_request output to long poller format
		let query = {
			actions: JSON.stringify(requests.actions),
			listeners: JSON.stringify(requests.listeners),
		}
		Object.for(requests.fields, (field, name)=>{
			query[name] = field.join(",")
		})
		
		return Req.request("Read/listen"+Req.queryString(query), 'GET', callback)
	},
	
	// if 
	lp_loop(getMe) {
		this.running = true
		//make sure only one instance of this is running
		let cancelled
		let x = this.lp_listen(getMe, (e, resp)=>{
			if (cancelled) { // should never happen (but I think it does sometimes..)
				console.log("OH HECK, request called callback after being cancelled?")
				//return //removing this for consistency since websocket doesn't have cancelling
			}
			this.process(e, resp)
			if (!e) {
				// I'm not sure this is needed. might be able to just call lp_loop diretcly?
				let t = setTimeout(()=>{
					if (cancelled) // should never happen?
						return
					this.lp_loop()
				}, 0)
				this.lp_cancel = ()=>{
					cancelled = true
					this.running = false
					clearTimeout(t)
				}
			}
		})
		this.lp_cancel = ()=>{
			cancelled = true
			this.running = false
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
			this.lastId = resp.lastId
			if (resp.listeners)
				this.lastListeners = resp.listeners
			
			let c = resp.chains // this SHOULD always be set, yeah?
			Entity.process(c)
			
			if (this.init || c.Ume) {
				print("got initial lp response!")
				this.init = false
				this.onStart(resp)
				if (this.use_websocket)
					this.ws_refresh(); // not always necessary, depends on timing (is this true?)
			}
			console.log('keeping data: ', resp)
			
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
				this.processed_listeners = out
				this.onListeners(out)
			}
			// todo: <debug missing comments here>
			if (c.comment)
				this.onMessages(c.comment, c.content)
			if (c.commentdelete)
				this.onMessages(c.commentdelete)
			if (c.activity)
				this.onActivity(c.activity, c.content)
		} catch (e) {
			console.error("error processing lp/ws response: ", e)
		}
	},
	
	websocket_flush() {
		if (this.websocket && this.websocket.readyState == 0)
			return;
		else if (this.websocket && this.websocket.readyState == 1) {
			if (this.ws_token) {
				if (this.ws_message.listeners) {
					this.ws_message.auth = this.ws_token
					this.websocket.send(JSON.stringify(this.ws_message))
				}
			}
		} else {
			this.open_websocket()
		}
	},
	
	// todo: we need to be 100% sure that the initial websocket config is NEVER changed until the ws returns initially, I think
	open_websocket() {
		if (this.websocket && this.websocket.readyState<2) {
			print('multiple websocket tried to open!')
			return;
		}
		let now = Date.now()
		if (now-this.last_open < 4000) {
			print('websocket loop too fast! delaying 5 seconds.\nThis is probably caused by an invalid websocket token. please report this')
			setTimeout(this.open_websocket.bind(this), 5000);
			return;
		}
		this.last_open = now
		this.ws_token = null
		this.websocket = new WebSocket("wss://"+Req.server+"/read/wslisten")
		// todo: we don't know whether the websocket will open before or after the auth token is gotten.
		// make sure we don't flush twice.
		Req.request("Read/wsauth", 'GET', (e, resp)=>{
			if (!e) {
				this.ws_token = resp
				print("got ws token!")
				this.websocket_flush()
				//this.ws_refresh(callback)
			} else {
				print('websocket auth failed:'+e)
			}
		})
		this.websocket.onopen = (e)=>{
			print("websocket open!")
			this.websocket_flush()
		}
		this.websocket.onerror = (e)=>{
			print("websocket error!"+e)
		}
		this.websocket.onclose = (e)=>{
			print("websocket close!")
			this.open_websocket()
		}
		this.websocket.onmessage = (e)=>{
			let match = String(e.data).match(/^(\w+):/)
			if (!match) {
				let resp
				try {
					resp = JSON.parse(e.data)
				} catch (e) {
					print("mystery websocket message:"+e.data)
					return
				}
				
				this.process(null, resp)
			} else if (match[1]=="accepted") {
				//print("websocket accepted")
			} else if (match[1]=="error") {
				print("websocket error: "+e.data)
			} else {
				print("websocket unknown message: "+e.data)
			}
		}
	},
}
