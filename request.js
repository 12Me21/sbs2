<!--/* trick indenter
window.Req = Object.create(null)
with (Req) (function($) { "use strict"
Object.assign(Req, { //*/
/*
  storageKey: "devauth",
*/
storageKey: "auth",

auth: null,
onLogin: null,
onLogout: null,

server: "smilebasicsource.com/api",

uid: null,

categoryTree: null,
gotCategoryTree: false,

onListeners: null,
onMessages: null,
onActivity: null,
lpLastId: 0,
lpStatuses: {"-1":"online"},
lpLastListeners: {"-1":{"0":""}},
lpProcessedListeners: {},
lpCancel: function(){},
lpRunning: false,
lpInit: true,

me: null,

rawRequest: function(url, method, callback, data, auth){
	var x = new XMLHttpRequest()
	x.open(method, url)
	var args = arguments
	
	var start = Date.now()
	x.onload = function() {
		var type = x.getResponseHeader('Content-Type')
		if (/^application\/json(?!=\w)/.test(type))
			var resp = JSON.safeParse(x.responseText)
		else
			resp = x.responseText
		var code = x.status
		
		if (code==200) //this should maybe check other 2xx responses, but I think 204 is (was?) used for timeouts...
			callback(null, resp)
		else if (code==502)
			retry(5000, 'bad gateway')
		else if (code==408 || code==204 || code==524)
			// record says server uses 408, testing showed only 204. idk
			retry(null, 'timeout')
		else if (code == 429) { // rate limit
			var after = +(x.getResponseHeader('Retry-After') || 1)
			retry((after+0.5)*1000, "rate limited "+after+"sec")
		} else if (code==400)
			callback('error', JSON.safeParse(resp))
		else if (code==401)
			callback('auth', resp)
		else if (code==403)
			callback('permission', resp)
		else if (code==404)
			callback('404', resp)
		else if (code==418)
			callback('ban', resp)
		else if (code==500) {
			print("got 500 error! "+resp)
			console.warn('got 500 error', x, resp)
			callback('error', JSON.safeParse(resp))
			//retry(1000, '500 error')
		} else { // other
			alert("Request failed! "+code+" "+url)
			console.log("REQUEST FAILED", x)
			resp = JSON.safeParse(resp)
			callback('error', resp, code)
		}
	}
	x.onerror = function() {
		var time = Date.now()-start
		//console.log("xhr onerror after ms:"+time)
		if (time > 18*1000)
			retry(null, "3ds timeout") // i think other browsers do this too now?
		else {
			print("Request failed!")
			retry(5000, "request error")
		}
	}
	
	x.setRequestHeader('Cache-Control', "no-cache, no-store, must-revalidate")
	x.setRequestHeader('Pragma', "no-cache") // for internet explorer
	auth && x.setRequestHeader('Authorization', "Bearer "+auth)
	
	if (data == undefined)
		x.send()
	else if (data.constructor == Object) { //plain object. we do need to support sending strings etc. as json later though...
		x.setRequestHeader('Content-Type', "application/json;charset=UTF-8")
		x.send(JSON.stringify(data))
	} else
		x.send(data)
	
	return x
	
	function retry(time, reason) {
		// this is not recursion because retry is called in async callback functions only!
		if (time) {
			console.log("will retry", reason, "in "+time/1000+" sec")
			if (time > 2000)
				try {
					Sidebar.print("Warning: request was rate limited with extremely long wait time: "+time/1000+" seconds")
				} catch(e) {}
			var id = $.setTimeout(function() {
				retry(null, reason)
			}, time)
			x.abort = function() {
				$.clearTimeout(id)
			}
		} else {
			console.log("retrying request", reason)
			x.abort = rawRequest.apply(null, args).abort
		}
	}
},

sendResetEmail: function(email, callback) {
	return request("User/passwordreset/sendemail", "POST", callback, {email: email})
},

resetPassword: function(key, password, callback) {
	return request("User/passwordreset", "POST", callback, {resetKey: key, password: password})
},

queryString: function(obj) {
	if (!obj)
		return ""
	var items = []
	for (var key in obj) {
		var val = obj[key]
		if (typeof val == 'undefined')
			continue
		var item = $.encodeURIComponent(key)+"="
		// array items are encoded as
		// ids:[1,2,3] -> ids=1&ids=2&ids=3
		if (val instanceof Array)
			val.forEach(function(x) {
				items.push(item+$.encodeURIComponent(x))
			})
		// otherwise, key=value
		else
			items.push(item+$.encodeURIComponent(val))
	}
	
	if (!items.length)
		return ""
	return "?"+items.join("&")
},

request: function(url, method, callback, data) {
	return rawRequest("https://"+server+"/"+url, method, function(e, resp) {
		if (e == 'auth')
			logOut()
		else
			callback(e, resp)
	}, data, auth)
},

// logs the user out and clears the cached token
logOut: function() {
	Store.remove(storageKey)
	lpStop()
	auth = null
	onLogout()
},

// call to set the current auth token
// should only be called once (triggers login event)
gotAuth: function(newAuth) {
	try {
		var newUid = Number(JSON.parse($.atob(newAuth.split(".")[1])).uid) //yeah
	} catch(e) {
		logOut()
		return false
	}
	auth = newAuth
	uid = newUid
	onLogin()
	return true
},

authenticate: function(username, password, callback) {
	return request("User/authenticate", 'POST', function(e, resp) {
		if (!e) {
			gotAuth(resp)
			Store.set(storageKey, resp, true)
		}
		callback(e, resp)
	}, {username: username, password: password})
},

// -haloopdy- You MUST be logged in for this to work!
websocketAuthenticate : function(callback) {
	return request("Read/wsauth", 'GET', function(e, resp) {
		callback(e, resp) //resp will be the raw temporary key!
	})
},

// try to load cached auth token from localstorage
// triggers onLogin and returns true if successful
// (doesn't check if auth is expired though)
tryLoadCachedAuth: function() {
	var auth = Store.get(storageKey)
	if (auth)
		var ok = gotAuth(auth)
	if (!ok)
		onGuestLoad()
	return ok
},

putFile: function(file, callback) {
	return request("File/"+file.id, 'PUT', callback, file)
},

register: function(username, password, email, callback) {
	return request("User/register", 'POST', callback, {
		username: username,
		password: password,
		email: email
	})
},

confirmRegister: function(key, callback) {
	return request("User/register/confirm", 'POST', callback, {
		confirmationKey: key
	})
},

sendEmail: function(email, callback) {
	return request("User/register/sendemail", 'POST', callback, {email: email})
},

read: function(requests, filters, callback, needCategories) {
	var query = {}
	query.requests = requests.map(function(req) {
		if (typeof req == 'string')
			return req
		else
			for (var type in req)
				return type+"-"+JSON.stringify(req[type])
	})
	Object.assign(query, filters)
	needCategories = needCategories && !gotCategoryTree
	if (needCategories)
		query.requests.push('category~Ctree')
	return request("Read/chain"+queryString(query), 'GET', function(e, resp) {
		if (!e) {
			handle(resp)
			if (needCategories)
				gotCategoryTree = true
		}
		callback(e, resp)
	})
},

listen: function(requests, filters, callback) {
	var $=this
	var query = {}
	requests.forEach(function(req) {
		for (var type in req) { // var type = first key in req
			query[type] = JSON.stringify(req[type])
			break
		}
	})
	Object.assign(query, filters)
	
	return request("Read/listen"+queryString(query), 'GET', function(e, resp) {
		if (!e)
			handle(resp.chains)
		callback(e, resp)
	})
},

// -haloopdy- A system for mimicking the "listen" function with websockets
listenMimic: {
	nextId: 1,  	  //Assign ids to ws for tracking, useful for glitches that let multiple ws stay open
	currentWs: null, //The currently active websocket, only unavailable on close
	//Update the websocket configuration in a manner similar to long polling,
	//but which is able to handle the independent lifetime of the websocket. You
	//will ALWAYS get a websocket object from this function, but with some
	//functions to mimic an XHR object as far as 12's frontend is concerned... maybe
	update: function(request, callback) 
	{ 
		//I really can't handle null requests, but they don't seem to happen.
		//This is a safety check just in case
		if(request == null) {
			console.error("SENT NULL REQUEST TO WEBSOCKET UPDATE!")
			return
		}

		//We do different things if the websocket was newly created in THIS call
		var newWebsocket = false

		//No currently 'running' websocket. A 'running' websocket is a websocket
		//that has not been closed yet, which includes 'trying to connect' websockets
		if(!listenMimic.currentWs) {
			listenMimic.currentWs = listenMimic.createNewWebsocket(function(ws) { ws.sendRequest(request, callback) })
			newWebsocket = true
		}

		//Some silly timing glitch can cause the currentWs field to become null
		//before the end of this call somehow? or maybe javascript is return by
		//reference??? I don't know how javascript works, but THIS works, so we
		//return the "thisWs" rather than the actual field in this object
		var thisWs = listenMimic.currentWs

		//Since the user gave us a callback, update the websocket events with new callback
		listenMimic.updateWebsocketEvents(listenMimic.currentWs, callback, function() {
			listenMimic.currentWs = null //remove currentWs as soon as we close!
		})

		//If we didn't just create a new websocket (which is a special request
		//that wraps up the first send), then we need to determine if a further
		//send is necessary! We don't want to unnecessarily send!
		if(!newWebsocket)
		{
			//As part of a network optimization, ignore requests which are the
			//same as the one we're currently tracking. The websocket internally
			//tracks simple updates, such as continually updating the lastId and
			//listener list. As such, many of the calls to this "update" function
			//from the longpoller can be ignored, since it just doesn't understand
			if(JSON.stringify(request) == JSON.stringify(listenMimic.currentWs.lastRequest)) {
				console.debug(`Ignoring ws update (${listenMimic.currentWs.wsId}), the current request is the same`)
			}
			else {
				console.log(`Updating websocket ${listenMimic.currentWs.wsId} with new request`)
				listenMimic.currentWs.sendRequest(request, callback)
			}
		}

		return thisWs
	},
	createNewWebsocket: function(onopen) { //Create websocket that "looks like" XHR
		//NOTE: because of nginx, "read" MUST be lowercased for websocket!
		var ws = new WebSocket("wss://"+server+"/read/wslisten")
		ws.wsId = listenMimic.nextId++
		//I was ORIGINALLY allowing the websocket to be actually aborted so it
		//mimics how the longpoller works, and because 12 is worried about
		//receiving data after the call, but it seems to work just fine and this
		//way is significantly cleaner and more performant
		ws.abort = function() { 
			console.debug(`IGNORING ABORT FOR WEBSOCKET ${ws.wsId}`)
		}
		//The "retry until you get it" websocket authorization function. It calls
		//an "onopen" function so we can optimize the "first time websocket"
		//connection and immediately send out the request data.
		var getAuth = function(onopen) {
			websocketAuthenticate(function(e, k) {
				if (!e) { 
					ws.currentToken = k 
					if (onopen)
						onopen(ws)
				} else {
					console.log("Failed to retrieve token, retrying: ", e);
					// 12: this is bad but i dont think it ever happens?
					setTimeout(getAuth, 3000)
				}
			})
		}
		ws.onopen = function() {
			console.log(`Websocket ${ws.wsId} opened!`)
			getAuth(onopen) //The websocket isn't technically "ready" until the authorization happens
		}
		//A special function which will defer a websocket update (a listener
		//request) if the websocket isn't ready to accept those updates.
		//Furthermore, it calls your callback function just like the longpoller
		//if you're trying to send to a closed websocket
		ws.sendRequest = function(request, callback) {
			if (ws.readyState === WebSocket.CLOSED) {
				console.error(`Tried to send websocket(${ws.wsId}) update request to closed websocket!`)
				callback('error', null)
			} else if (!ws.currentToken) {
				console.warn(`Tried to send websocket(${ws.wsId}) update request before websocket was ready, trying again later`)
				setTimeout(function() { ws.sendRequest(request, callback) }, 500)
			} else {
				//We want to track the requests so we can optimize the network
				//traffic. The longpoller doesn't understand that the websocket
				//endpoint already tracks simple updates
				ws.lastRequest = {}
				Object.assign(ws.lastRequest, request)
				var req = {} //need a NEW request so we don't accidentally modify something
				Object.assign(req, request)
				req.auth = ws.currentToken
				ws.send(JSON.stringify(req))
			}
		}
		
		return ws
	},
	//A function to reassign all the pertinent websocket events with a new
	//callback. Although... it might not be necessary?
	updateWebsocketEvents: function(ws, callback, onclose) {
		ws.onerror = function(e) {
			console.error(`WEBSOCKET ${ws.wsId} ERROR: `, e)
			callback('error', null)
		}
		ws.onclose = function(e) {
			console.debug(`WEBSOCKET ${ws.wsId} CLOSE: `, e)
			if (onclose)
				onclose()
			var fake = {lastId: ws.lastRequest.lastId}
			callback(null, fake) //will this cause problems???
		}
		ws.onmessage = function(e) {
         if (e.data) {
				let match = String(e.data).match(/^(\w+):/)
				if (!match) {
					try {
						var data = JSON.parse(e.data)
					} catch (e) {
						print ("mystery websocket message:"+e.data)
						return;
					}
					if (ws.lastRequest) {
						//TODO: bug: when userlist updates, it seems to produce
						//websocket updates. I mean it's just a send to the server,
						//but that means the websocket isn't quite as efficient... 
						if(data.lastId && ws.lastRequest.actions)
							ws.lastRequest.actions.lastId = data.lastId
						if(data.listeners && ws.lastRequest.listen)
							ws.lastRequest.listen.lastListeners = data.listeners
					}
					handle(data.chains)
					callback(null, data)
            } else if (match[1]=="accepted") {
				} else if (match[1]=="error") {
					print("websocket error: "+e.data)
				} else {
					print("websocket unknown message: "+e.data)
				}
         }
		}
	}
},

// -haloopdy- Mimics the "listen" function, but uses a persistent websocket
// (whenever possible) instead.
websocketListen: function(requests, filters, callback) {
	//Set up "websocket" version of object
	var wsRequest = { fields : { } };
	for(var k in filters) {
		wsRequest.fields[k] = filters[k].split(",")
	}
	//Why was it done like this? Maybe because of my API...
	requests.forEach(function(req) {
		for (var type in req) { // var type = first key in req
			wsRequest[type] = req[type]
			break
		}
	})
	return listenMimic.update(wsRequest, callback)
},

handle: function(resp) {
	Entity.process(resp)
},

getMe: function(callback) {
	return request("User/me", 'GET', function(e, resp) {
		if (!e) {
			var l = [resp]
			Entity.processList('user',l,{})
			callback(l[0])
		} else
			callback(null)
	})
},

setBasic: function(data, callback) {
	return request("User/basic", 'PUT', function(e, resp) {
		if (!e) {
			var l = [resp]
			Entity.processList('user',l,{})
			callback(l[0])
		} else
			callback(null)
	}, data)
},

setSensitive: function(data, callback) {
	return request("User/sensitive", 'POST', callback, data)
},

// this should accept as many types as possible
uploadImage: function(thing, callback) {
	if (thing instanceof HTMLCanvasElement) {
		thing.toBlob(function(blob) {
			if (blob)
				uploadFile(blob, callback)
			else
				callback(null)
		})
	} else if (thing instanceof File || thing instanceof Blob) {
		uploadFile(thing, callback)
	} else if (thing instanceof Image) {
		callback(null)
		// todo
	} else {
		callback(null)
	}
},

uploadFile: function(file, callback) {
	var form = new FormData()
	form.append('file', file)
	var params = new URLSearchParams();
	if (file.bucket)
		params.set("bucket", file.bucket)
	if (file.quantize)
		params.set("quantize", file.quantize)
	if (file.name)
		params.set("name", file.filename)
	params.set("tryresize", true) //debug option
	
	request("File?" + params.toString(), 'POST', function(e, resp) {
		if (e)
			callback(null)
		else {
			var l = [resp]
			Entity.processList('file',l,{})
			callback(l[0])
		}
	}, form)
},

toggleHiding: function(id, callback) {
	return getMe(function(me) {
		if (me) {
			var hiding = me.hidelist
			var hidden = arrayToggle(hiding, id)
			console.log(hiding)
			setBasic({hidelist:hiding}, function(){
				callback(hidden)
			})
		} else
			callback(null)
	})
},

getCategories: function(callback) {
	return read([], {}, callback, true)
},

searchUsers: function(text, callback) {
	var like = text.replace(/%/g,"_") //the best we can do...
	var count = 20
	return read([
		{user: {limit: count, usernameLike: "%"+like+"%", sort: 'editDate', reverse: true}}
	],{},function(e, resp) {
		if (!e)
			callback(resp.userMap)
		else
			callback(null)
	})
},

search1: function(text, callback) {
	var like = text.replace(/%/g,"_") //the best we can do...
	var count = 20
	var page = 0
	page = page*count
	return read([
		{"user~Usearch": {limit: count, skip: page, usernameLike: like+"%"}}, 
		{content: {limit: count, skip: page, nameLike: "%"+like+"%"}},
		{content: {limit: count, skip: page, keyword: like}},
		"user.1createUserId.2createUserId"
	],{
		content: "name,id,type,permissions,createUserId" //eh
	}, function(e, resp) {
		if (!e)
			callback(resp.Usearch, resp.content)
		else
			callback(null)
	})
},

getRecentActivity: function(callback) {
	var day = 1000*60*60*24
	var start = new Date(Date.now() - day).toISOString()
	// "except no that won't work if site dies lol"
	return read([
		{activity: {createStart: start}},
		{commentaggregate: {createStart: start}},
		{"activity~Awatching": {contentLimit:{watches:true}}},
		{"commentaggregate~CAwatching": {contentLimit:{watches:true}}},
		"content.0contentId.1id.2contentId.3id",
		{comment: {limit: 50, reverse: true, createStart: start}},
		"user.0userId.1userIds.2userId.3userIds.5createUserId",
	], {
		content: "name,id,permissions,type"
	}, function(e, resp) {
		console.log(resp)
		if (!e)
			callback(resp.activity, resp.commentaggregate, resp.Awatching, resp.CAwatching, resp.content, resp.comment.reverse())
		else
			callback(null)
	})
},

setVote: function(id, state, callback) {
	return request("Vote/"+id+"/"+(state||"delete"), 'POST', callback)
},

editPage: function(page, callback) {
	if (page.id)
		request("Content/"+page.id, 'PUT', callback, page)
	else
		request("Content", 'POST', callback, page)
},

getComment: function(id, callback) {
	return read([
		{comment: {ids: [id]}}//todo: maybe also get page permissions?
	], {}, function(e, resp) {
		if (!e)
			callback(resp.comment[0])
		else
			callback(null)
	})
},

getCommentsBefore: function(id, firstId, count, callback) {
	var fi = {reverse: true, limit: count, parentIds: [id]}
	if (firstId != null)
		fi.maxId = firstId // maxId is EXCLUSIVE
	return read([
		{comment: fi},
		"user.0createUserId.0editUserId",
	], {}, function(e, resp) {
		if (!e)
			callback(resp.comment)
		else
			callback(null)
	})
},

getCommentsAfter: function(id, lastId, count, callback) {
	var fi = {limit: count, parentIds: [id]}
	if (lastId != null)
		fi.minId = lastId
	return read([
		{comment: fi},
		"user.0createUserId.0editUserId",
	], {}, function(e, resp) {
		if (!e)
			callback(resp.comment)
		else
			callback(null)
	})
},

sendMessage: function(room, message, meta, callback) {
	return request("Comment", 'POST', callback, {parentId: room, content: JSON.stringify(meta)+"\n"+message})
},

editMessage: function(id, room, message, meta, callback) {
	return request("Comment/"+id, 'PUT', callback, {parentId: room, content: JSON.stringify(meta)+"\n"+message})
},

deleteMessage: function(id, callback) {
	return request("Comment/"+id+"/delete", 'POST', callback)
},

doListenInitial: function(callback) {
	return read([
		//"systemaggregate",
		{comment: {reverse:true, limit:20}},
		{activity: {reverse:true, limit:10}},
		{activityaggregate: {reverse:true, limit:10}},
		"content.0parentId.1contentId.0id", //pages
		"category.1contentId",
		"user.0createUserId.1userId.2userIds", //users for comment and activity
	], {content: "id,createUserId,name,permissions,type"}, callback)
},

doListen: function(lastId, statuses, lastListeners, getMe, callback) {
	var actions = {
		lastId: lastId,
		statuses: statuses,
		chains: [
			"comment.0id",'activity.0id-{"includeAnonymous":true}',"watch.0id", //new stuff //changed
			"content.1parentId.2contentId.3contentId", //pages
			"user.1createUserId.2userId.1editUserId.2contentId", //users for comment and activity
			"category.2contentId" //todo: handle values returned by this
		]
	}
	if (getMe)
		var listeners = {
			// TODO: make sure lastListeners is something that will never occur so you'll always get the update
			lastListeners: lastListeners,
			chains: [
				"user.0listeners",
				'user~Ume-{"ids":['+ +uid +'],"limit":1}'
			]
		}
	else
		listeners = {
			lastListeners: lastListeners,
			chains: ["user.0listeners"]
		}
	return listen([
		{actions: actions},
		{listeners: listeners}
	], {
		content: "id,createUserId,name,permissions,type"
	}, callback)
},

lpRefresh: function() {
	if (lpRunning && !lpInit) {
		lpCancel()
		lpLoop()
	}
},

lpStart: function(callback) {
	if (!lpRunning)
		lpLoop(callback)
},

lpStop: function() {
	lpCancel()
	lpRunning = false
},

handleOnListeners: function(listeners, users) {
	var out = {}
	// process listeners (convert uids to user objetcs)
	for (var id in listeners) {
		var list = listeners[id]
		var list2 = {}
		for (var uid in list)
			list2[uid] = {user: users[uid], status: list[uid]}
		out[id] = list2
	}
	lpProcessedListeners = out
	onListeners(out)
},

lpProcess: function(resp) {
	if (resp.listeners) {
		handleOnListeners(resp.listeners, resp.chains.userMap)
	}
	if (resp.chains) {
		if (resp.chains.comment)
			onMessages(resp.chains.comment, resp.chains.content)
		if (resp.chains.commentdelete)
			onMessages(resp.chains.commentdelete)
		if (resp.chains.activity)
			onActivity(resp.chains.activity, resp.chains.content)
	}
},

lpLoop: function(noCancel) {
	lpRunning = true
	//make sure only one instance of this is running
	var cancelled
	var x = doListen(lpLastId, lpStatuses, lpLastListeners, noCancel, function(e, resp) {
		if (noCancel) {
			lpInit = false
			noCancel(e, resp)
		}
		if (cancelled) { // should never happen (but I think it does sometimes..)
			console.log("OH HECK, request called callback after being cancelled?")
			return
		}
		if (!e) {
			// try/catch here so the long poller won't fail when there's an error in the callbacks
			try {
				lpLastId = resp.lastId
				if (resp.listeners)
					lpLastListeners = resp.listeners
				lpProcess(resp)
			} catch (e) {
				console.error(e)
			}
			// I'm not sure this is needed. might be able to just call lpLoop diretcly?
			var t = setTimeout(function() {
				if (cancelled) // should never happen?
					return
				lpLoop()
			}, 0)
			lpCancel = function() {
				cancelled = true
				lpRunning = false
				clearTimeout(t)
			}
		} else {
			alert("LONG POLLER FAILED:"+resp)
			console.log("LONG POLLER FAILED", e, resp)
		}
	})
	lpCancel = function() {
		cancelled = true
		lpRunning = false
		x.abort()
	}
},

lpSetListening: function(ids) {
	console.log("setting listeners")
	var newListeners = {"-1": lpLastListeners[-1]}
	ids.forEach(function(id) {
		newListeners[id] = lpLastListeners[id] || {"0":""}
	})
	lpLastListeners = newListeners
},

fileURL: function(id, query) {
	if (query)
		return "https://"+server+"/File/raw/"+id+"?"+query
	return "https://"+server+"/File/raw/"+id
},

lpSetStatus: function(statuses) {
	for (var id in statuses) {
		var status = statuses[id]
		lpStatuses[id] = status
		// set status in lastListeners, so we won't cause the long poller to complete instantly
		if (!lpLastListeners[id])
			lpLastListeners[id] = {}
		lpLastListeners[id][uid] = status
		// but now, since the long poller won't complete (sometimes)
		// we have to update the userlist visually with our changes
		// if another client is setting your status and overrides this one
		// your (local) status will flicker, unfortunately
		// of the 2 options, this one is better in general, I think
		// it reduces lp completions
		// wait, but... does it really?
		if (!lpProcessedListeners[id])
			lpProcessedListeners[id] = {}
		lpProcessedListeners[id][uid] = {user: me, status: status}
	}
	onListeners(lpProcessedListeners)
	lpRefresh()
},

<!--/* 
}) //*/

function arrayToggle(array, value) {
	var i = array.indexOf(value)
	if (i<0) {
		array.push(value)
		return true
	}
	array.splice(i, 1)
	return false
}

//this is to trick a script
if (0)
server = protocol+"//newdev.smilebasicsource.com/api"

<!--/*
}(window)) //*/
