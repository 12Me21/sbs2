<!--/* trick indenter
window.Lp = Object.create(null)
with (Lp) (function($) { "use strict"
Object.assign(Lp, { //*/

// these are set in view.js
// even though maybe they should not be?
statuses: {"-1":"online"},
lastListeners: {"-1":{"0":""}},
// this is used in displaying the userlist
processedListeners: {},

// events, set externally
onListeners: null,
onMessages: null,
onActivity: null,

gotMessages: [],

use_websocket: false,
first_websocket: true,

// call this after setting the parameters
lpRefresh: function() {
	if (running && !lpInit) {
		if (use_websocket) {
			wsRefresh()
		} else {
			lpCancel()
			lpLoop()
		}
	}
},

start: function(callback) {
	if (!running) {
		if (use_websocket) {
			print('starting lp: websocket')
			open_websocket(callback)
		} else {
			print('starting lp: long poller')
			lpLoop(callback)
		}
	}
},

lpStop: function() {
	if (websocket) {
		ws.close()
	} else {
		lpCancel()
	}
	running = false
},

lpSetListening: function(ids) {
	console.log("setting listeners")
	var newListeners = {"-1": lastListeners[-1]}
	ids.forEach(function(id) {
		newListeners[id] = lastListeners[id] || {"0":""}
	})
	lastListeners = newListeners
},

lpSetStatus: function(statuses) {
	for (var id in statuses) {
		var status = statuses[id]
		statuses[id] = status
		// set status in lastListeners, so we won't cause the long poller to complete instantly
		if (!lastListeners[id])
			lastListeners[id] = {}
		lastListeners[id][Req.uid] = status
		// but now, since the long poller won't complete (sometimes)
		// we have to update the userlist visually with our changes
		// if another client is setting your status and overrides this one
		// your (local) status will flicker, unfortunately
		// of the 2 options, this one is better in general, I think
		// it reduces lp completions
		// wait, but... does it really?
		if (!processedListeners[id])
			processedListeners[id] = {}
		processedListeners[id][Req.uid] = {user: me, status: status}
	}
	onListeners(processedListeners)
	lpRefresh()
},

<!--/* 
}) //*/

;// PRIVATE

var lastId = 0
var lpInit = true
var running = false

function wsRefresh(me) {
	running = true
	var req = make_listen(lastId, statuses, lastListeners, me)
	
	req.auth = ws_token
	//print('ws send')
	websocket.send(JSON.stringify(req))
}

var lpCancel = function(){}

function make_listen(lastId, statuses, lastListeners, getMe) {
	var requests = make_request(lastId, statuses, lastListeners, getMe)
	
	var query = {}
	if (use_websocket) {
		requests.forEach(function(req) {
			for (var type in req) { // var type = first key in req
				query[type] = req[type]
				break
			}
		})
		query.fields = {content:["id","createUserId","name","permissions","type"]}
	} else {
		requests.forEach(function(req) {
			for (var type in req) { // var type = first key in req
				query[type] = JSON.stringify(req[type])
				break
			}
		})
		Object.assign(query, {content: "id,createUserId,name,permissions,type"})
	}
	return query
}

function make_request(lastId, statuses, lastListeners, getMe) {
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

function doListen(lastId, statuses, lastListeners, getMe, callback) {
	var query = make_listen(lastId, statuses, lastListeners, getMe)
	
	return Req.request("Read/listen"+Req.queryString(query), 'GET', function(e, resp) {
		if (!e)
			Req.handle(resp.chains)
		callback(e, resp)
	})
}

function lpLoop(noCancel) {
	running = true
	//make sure only one instance of this is running
	var cancelled
	var x = doListen(lastId, statuses, lastListeners, noCancel, function(e, resp) {
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
				lastId = resp.lastId
				if (resp.chains) {
					if (resp.chains.comment) {
						if (resp.chains.comment instanceof Array) {
							for (let c of resp.chains.comment) {
								gotMessages.push(c.id)
							}
						} else {
							print("weird chains comment")
							window.hecked = resp 
						}
					}
				}
				if (resp.listeners)
					lastListeners = resp.listeners
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
				running = false
				clearTimeout(t)
			}
		} else {
			alert("LONG POLLER FAILED:"+resp)
			console.log("LONG POLLER FAILED", e, resp)
		}
	})
	lpCancel = function() {
		cancelled = true
		running = false
		x.abort()
	}
}

function handleOnListeners(listeners, users) {
	var out = {}
	// process listeners (convert uids to user objetcs)
	for (var id in listeners) {
		var list = listeners[id]
		var list2 = {}
		for (var uid in list)
			list2[uid] = {user: users[uid], status: list[uid]}
		out[id] = list2
	}
	processedListeners = out
	onListeners(out)
}

function lpProcess(resp) {
	if (resp.listeners) {
		console.log("lp process", resp)
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
}
//

var websocket = null
var ws_token = null

function open_websocket(callback) {
	websocket = new WebSocket("wss://"+Req.server+"/read/wslisten")
	Req.request("Read/wsauth", 'GET', function(e, resp) {
		if (!e) {
			ws_token = resp
			print("got ws token!")
			wsRefresh(callback)
		} else {
			print('websocket auth failed:'+e)
		}
	})
	websocket.onopen = function(e) {
		print("websocket open!")
	}
	websocket.onerror = function(e) {
		print("websocket error!"+e)
		open_websocket()
	}
	websocket.onclose = function(e) {
		print("websocket close!"+e)
	}
	websocket.onmessage = function(e) {
		let match = String(e.data).match(/^(\w+):/)
		if (!match) {
			try {
				var resp = JSON.parse(e.data)
			} catch (e) {
				print ("mystery websocket message:"+e.data)
				return;
			}
			try {
				lastId = resp.lastId
				if (resp.listeners)
					lastListeners = resp.listeners
				
				if (first_websocket) { //very bad hack
					print("first!!!")
					callback(null, resp)
					lpInit = false
					first_websocket = false
				} else {
					Req.handle(resp.chains)
					lpProcess(resp)	
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

;
<!--/*
}(window)) //*/
