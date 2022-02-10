let Lp = new class Lp {
	statuses = {"-1":"online"}
	lastListeners = {"-1":{"0":""}}
	// this is used in displaying the userlist
	processedListeners = {}
	
	// events, set externally
	onListeners = null
	onMessages = null
	onActivity = null
	onStart = null
	
	gotMessages = []
	
	use_websocket = false
	first_websocket = true
	
	// debug
	ws_message = {} 
	websocket = null
	
	///////////////////////
	// PRIVATE variables //
	///////////////////////
	lastId = 0
	lpInit = true
	running = false
	lpCancel = ()=>{}
	ws_token = null
	last_open = 0
	
	////////////////////
	// public methods //
	////////////////////
	
	// call this after setting the parameters
	lpRefresh() {
		if (this.running && !this.lpInit) {
			if (this.use_websocket) {
				this.wsRefresh()
			} else {
				this.lpCancel()
				this.lpLoop()
			}
		}
	}
	
	start(callback) {
		if (!this.running) {
			if (this.use_websocket) {
				print('starting lp: websocket')
				this.wsRefresh(true)
			} else {
				print('starting lp: long poller')
				this.lpLoop(this.onStart)
			}
		}
	}
	
	lpStop() {
		if (this.websocket) {
			this.websocket.close()
		} else {
			this.lpCancel()
		}
		this.running = false
	}
	
	lpSetListening(ids) {
		let newListeners = {"-1": this.lastListeners[-1]}
		ids.forEach((id)=>newListeners[id] = this.lastListeners[id] || {"0":""})
		this.lastListeners = newListeners
	}
	
	lpSetStatus(statuses) {
		for (let id in statuses) {
			let status = statuses[id]
			statuses[id] = status
			// set status in lastListeners, so we won't cause the long poller to complete instantly
			if (!this.lastListeners[id])
				this.lastListeners[id] = {}
			this.lastListeners[id][Req.uid] = status
			// but now, since the long poller won't complete (sometimes)
			// we have to update the userlist visually with our changes
			// if another client is setting your status and overrides this one
			// your (local) status will flicker, unfortunately
			// of the 2 options, this one is better in general, I think
			// it reduces lp completions
			// wait, but... does it really?
			if (!this.processedListeners[id])
				this.processedListeners[id] = {}
			this.processedListeners[id][Req.uid] = {user: Req.uid, status: status}
		}
		this.onListeners(this.processedListeners)
		this.lpRefresh()
	}
	
	/////////////////////////
	// "private" functions //
	/////////////////////////
	
	wsRefresh(me) {
		this.running = true
		let req = this.make_listen(this.lastId, this.statuses, this.lastListeners, me)
		this.ws_message = req
		this.websocket_flush()
	}
	
	make_listen(lastId, statuses, lastListeners, getMe) {
		let requests = this.make_request(lastId, statuses, lastListeners, getMe)
		
		let query = {}
		if (this.use_websocket) {
			requests.forEach((req)=>{
				for (let type in req) { // var type = first key in req
					query[type] = req[type]
					break
				}
			})
			query.fields = {content:['id','createUserId','name','permissions','type']}
		} else {
			requests.forEach((req)=>{
				for (let type in req) { // var type = first key in req
					query[type] = JSON.stringify(req[type])
					break
				}
			})
			Object.assign(query, {content: "id,createUserId,name,permissions,type"})
		}
		return query
	}
	
	make_request(lastId, statuses, lastListeners, getMe) {
		let actions = {
			lastId: lastId,
			statuses: statuses,
			chains: [
				"comment.0id",'activity.0id-{"includeAnonymous":true}',"watch.0id", //new stuff //changed
				"content.1parentId.2contentId.3contentId", //pages
				"user.1createUserId.2userId.1editUserId.2contentId", //users for comment and activity
				"category.2contentId" //todo: handle values returned by this
			]
		}
		let listeners
		if (getMe)
			listeners = {
				// TODO: make sure lastListeners is something that will never occur so you'll always get the update
				lastListeners: lastListeners,
				chains: [
					"user.0listeners",
					'user~Ume-{"ids":['+ +Req.uid +'],"limit":1}'
				]
			}
		else
			listeners = {
				lastListeners: lastListeners,
				chains: ["user.0listeners"]
			}
		return [
			{actions: actions},
			{listeners: listeners}
		]
	}
	
	doListen(lastId, statuses, lastListeners, getMe, callback) {
		let query = this.make_listen(lastId, statuses, lastListeners, getMe)
		
		return Req.request("Read/listen"+Req.queryString(query), 'GET', (e, resp)=>{
			if (!e)
				Entity.process(resp.chains)
			callback(e, resp)
		})
	}
	
	lpLoop(noCancel) {
		this.running = true
		//make sure only one instance of this is running
		let cancelled
		let x = this.doListen(this.lastId, this.statuses, this.lastListeners, noCancel, (e, resp)=>{
			if (noCancel) {
				this.lpInit = false
				noCancel(e, resp)
			}
			if (cancelled) { // should never happen (but I think it does sometimes..)
				console.log("OH HECK, request called callback after being cancelled?")
				return
			}
			if (!e) {
				// try/catch here so the long poller won't fail when there's an error in the callbacks
				try {
					this.lastId = resp.lastId
					if (resp.chains) {
						if (resp.chains.comment) {
							if (resp.chains.comment instanceof Array) {
								for (let c of resp.chains.comment) {
									this.gotMessages.push(c.id)
								}
							} else {
								print("weird chains comment")
								window.hecked = resp 
							}
						}
					}
					if (resp.listeners)
						this.lastListeners = resp.listeners
					this.lpProcess(resp)
				} catch (e) {
					console.error(e)
				}
				// I'm not sure this is needed. might be able to just call lpLoop diretcly?
				let t = setTimeout(()=>{
					if (cancelled) // should never happen?
						return
					this.lpLoop()
				}, 0)
				this.lpCancel = ()=>{
					this.cancelled = true
					this.running = false
					clearTimeout(t)
				}
			} else {
				alert("LONG POLLER FAILED:"+resp)
				console.log("LONG POLLER FAILED", e, resp)
			}
		})
		this.lpCancel = ()=>{
			this.cancelled = true
			this.running = false
			x.abort()
		}
	}
	
	handleOnListeners(listeners, users) {
		let out = {}
		// process listeners (convert uids to user objetcs)
		for (let id in listeners) {
			let list = listeners[id]
			let list2 = {}
			for (let uid in list)
				list2[uid] = {user: users[uid], status: list[uid]}
			out[id] = list2
		}
		this.processedListeners = out
		this.onListeners(out)
	}
	
	lpProcess(resp) {
		if (resp.listeners) {
			//console.log("lp process", resp)
			this.handleOnListeners(resp.listeners, resp.chains.userMap)
		}
		if (resp.chains) {
			if (resp.chains.comment)
				this.onMessages(resp.chains.comment, resp.chains.content)
			if (resp.chains.commentdelete)
				this.onMessages(resp.chains.commentdelete)
			if (resp.chains.activity)
				this.onActivity(resp.chains.activity, resp.chains.content)
		}
	}
	
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
	}
	
	// todo: we need to be 100% sure that the initial websocket config is NEVER changed until the ws returns initially, I think
	open_websocket() {
		if (this.websocket && this.websocket.readyState<2) {
			print('multiple websocket tried to open!')
			return;
		}
		let now = Date.now()
		if (now-this.last_open < 4000) {
			print('websocket loop too fast! delaying 5 seconds.\nThis is probably caused by an invalid websocket token. please report this')
			setTimeout(this.open_websocket, 5000);
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
				//this.wsRefresh(callback)
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
				try {
					this.lastId = resp.lastId
					
					Entity.process(resp.chains)
					
					if (this.first_websocket) { //very bad hack
						print("first!!!")
						this.first_websocket = false
						this.lpInit = false
						this.onStart(null, resp)
						// this is a hack for in case
						// the initial response takes too long idk etc.
						this.wsRefresh(); // not always necessary, depends on timing
					} else {
						// unlike long poller, we DON'T keep this data on the initial response, due to bugs and idk..
						if (resp.listeners)
							this.lastListeners = resp.listeners
						//
						this.lpProcess(resp)
					}
				} catch (e) {
					console.error(e)
				}
			} else if (match[1]=="accepted") {
				//print("websocket accepted")
			} else if (match[1]=="error") {
				print("websocket error: "+e.data)
			} else {
				print("websocket unknown message: "+e.data)
			}
		}
	}
}
