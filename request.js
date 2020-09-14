<!--/* trick indenter
window.Req = Object.create(null)
with (Req) (function($) { "use strict"
Object.assign(Req, { //*/

storageKey: "devauth",

protocol: null,

auth: null,
onLogin: null,
onLogout: null,

server: null,

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

me: null,

rawRequest: function(url, method, callback, data, auth){
	var x = new $.XMLHttpRequest()
	x.open(method, url)

	var start = $.Date.now()
	x.onload = function() {
		var code = x.status
		var type = x.getResponseHeader('Content-Type')
		if (/^application\/json(?!=\w)/.test(type)) {
			try {
				var resp = JSON.parse(x.responseText)
			} catch(e) {
				resp = null
			}
		} else {
			resp = x.responseText
		}
		if (code==200) {
			callback(null, resp)
		} else if (code==408 || code==204 || code==524) {
			// record says server uses 408, testing showed only 204
			// basically this is treated as an error condition,
			// except during long polling, where it's a normal occurance
			retry(arguments)
			//callback('timeout', resp)
		} else if (code == 429) { // rate limit
			$.setTimeout(function() {
				retry(arguments)
				//callback('rate', resp)
			}, 1000)
		} else if (code==401 || code==403) {
			callback('auth', resp)
		} else if (code==404) {
			callback('404', resp)
		} else if (code==400) {
			try {
				resp = $.JSON.parse(resp)
			} catch(e) {
			}
			callback('error', resp)
		} else {
			alert("Request failed! "+code+" "+url)
			//console.log("sbs2Request: request failed! "+code)
			//console.log(x.responseText)
			console.log("REQUEST FAILED", x)
			try {
				resp = $.JSON.parse(resp)
			} catch(e) {
			}
			callback('error', resp, code)
		}
	}
	x.onerror = function() {
		var time = $.Date.now()-start
		//$.console.log("xhr onerror after ms:"+time)
		if (time > 18*1000) {
			//$.console.log("detected 3DS timeout")
			retry(arguments)
			//callback('timeout')
		} else {
			$.alert("Request failed! "+url)
			$.console.log("xhr onerror")
			callback('fail')
		}
	}
	x.setRequestHeader('Cache-Control', "no-cache, no-store, must-revalidate")
	x.setRequestHeader('Pragma', "no-cache") // for internet explorer
	if (auth)
		x.setRequestHeader('Authorization', "Bearer "+auth)
	
	if (data) {
		if (data && data.constructor == Object) { //plain object
			x.setRequestHeader('Content-Type',"application/json;charset=UTF-8")
			x.send(JSON.stringify(data))
		} else { //string, formdata, arraybuffer, etc.
			x.send(data)
		}
	} else {
		x.send()
	}
	return x

	function retry(args) {
		// this is not recursion because retry is called in async callback functions only!

		// external things rely on .abort to cancel the request, so...
		// a hack, perhaps...
		x.abort = rawRequest.apply(null, args).abort
	}
},

queryString: function(obj) {
	if (!obj)
		return ""
	var items = []
	for (var key in obj) {
		var val = obj[key]
		if (typeof val != 'undefined'){
			var item = $.encodeURIComponent(key)+"="
			// array items are encoded as
			// ids:[1,2,3] -> ids=1&ids=2&ids=3
			if (val instanceof $.Array) {
				for(var i=0;i<val.length;i++){
					items.push(item+$.encodeURIComponent(val[i]))
				}
			// otherwise, key=value
			} else {
				items.push(item+$.encodeURIComponent(val))
			}
		}
	}
	
	if (items.length)
		return "?"+items.join("&")
	else
		return ""
},

request: function(url, method, callback, data) {
	return rawRequest(server+"/"+url, method, function(e, resp) {
		if (e == 'auth')
			logOut()
		else
			callback(e, resp)
	}, data, auth)
},

// logs the user out and clears the cached token
logOut: function() {
	$.Store.remove(storageKey)
	lpStop()
	auth = null
	onLogout()
},

// call to set the current auth token
// should only be called once (triggers login event)
gotAuth: function(newAuth) {
	try {
		var newUid = Number($.JSON.parse($.atob(newAuth.split(".")[1])).uid)
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
			$.Store.set(storageKey, resp, true)
		}
		callback(e, resp)
	}, {username: username, password: password})
},

// try to load cached auth token from localstorage
// triggers onLogin and returns true if successful
// (doesn't check if auth is expired though)
tryLoadCachedAuth: function() {
	var auth = $.Store.get(storageKey)
	if (auth)
		var ok = gotAuth(auth)
	if (!ok)
		onGuestLoad()
	return ok
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
		for (var type in req) {
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

handle: function(resp) {
	Entity.process(resp)
},

getMe: function(callback) {
	return request("User/me", 'GET', function(e, resp) {
		if (!e) {
			var l = [resp]
			Entity.processList('user',l,{})
			callback(l[0])
		} else {
			callback(null)
		}
	})
},

setBasic: function(data, callback) {
	return request("User/basic", 'PUT', callback, data)
},

uploadFile: function(file, callback) {
	var form = new FormData()
	form.append('file', file)
	request("File", 'POST', function(e, resp) {
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
			arrayToggle(hiding, id)
			setBasic({hidelist:hiding}, function(){
				callback(hiding)
			})
		} else
			callback(null)
	})
},

getCategories: function(callback) {
	return read([], {}, callback, true)
},

// takes a number or a string
getUserView: function(id, callback) {
	if (typeof id == 'number')
		var userSearch = {ids: [id], limit: 1}
	else
		var userSearch = {usernames: [id], limit: 1}
	
	return read([
		{"user": userSearch},
		{"content.0id$createUserIds~Puserpage": {type: '@user.page', limit: 1}},
		{"activity.0id$userIds": {limit: 20, reverse: true}},
		{"commentaggregate.0id$userIds": {limit: 100, reverse: true}},
		"content.2contentId.3id"
	],{},function(e, resp) {
		console.log(resp)
		if (!e) {
			var user = resp.user[0]
			if (user) {
				callback(user, resp.Puserpage[0], resp.activity, resp.commentaggregate, resp.content)
			} else {
				callback(null)
			}
		} else {
			callback(null) // todo: better/more standard error handlign?
		}
	}, true)
},

getFileView: function(query, page, callback) {
	var $=this
	query.limit = 20
	query.skip = page*query.limit
	query.reverse = true
	return $.read([
		{file: query},
		"user.0createUserId"
	], {}, function(e, resp) {
		if (!e)
			callback(resp.file)
		else
			callback(null)
	}, false) //mm
},

getChatView: function(id, callback) {
	return read([
		{content: {ids: [id]}},
		{comment: {parentIds: [id], limit: 20, reverse: true}},
		"user.0createUserId.0editUserId.1createUserId.1editUserId",
	], {
		content: "name,parentId,type,createUserId,editUserId,createDate,editDate,permissions,id"
	}, function(e, resp) {
		// todo: ok so we have 2 levels of error here
		// either the request fails somehow (e is set)
		// or, the page/whatever we're trying to access doesn't exist
		// this exists for pretty much every view/request type
		// so it would be good to handle it consistently
		if (!e) {
			if (resp.content[0]) {
				resp.comment.reverse()
				callback(resp.content[0], resp.comment)
			} else
				callback(null)
		}
	}, true)
},

getUsersView: function(callback) {
	return read([
		"user",
	], {}, function(e, resp) {
		if (!e) {
			callback(resp.user)
		}
	}, true)
},

setVote: function(id, state, callback) {
	return request("Vote/"+id+"/"+(state||"delete"), 'POST', callback)
},

getPageView: function(id, callback) {
	return read([
		{content: {ids: [+id], includeAbout: true}},
		"user.0createUserId.0editUserId",
	], {}, function(e, resp) {
		if (!e && resp.content[0])
			callback(resp.content[0])
		else
			callback(null)
	}, true)
},

getCategoryView: function(id, callback) {
	var search = {
		parentIds: [id],
		limit: 10,
		sort: 'editDate',
		reverse: true
	}
	return read([
		{'category~Cmain': {ids: [id]}},
		{content: search},
		{category: {parentIds: [id]}},
		"content.0values_pinned~Ppinned",
		"user.1createUserId.3createUserId"
	], {
		content: "id,name,parentId,createUserId,editDate,permissions",
		/*category: "id,name,description,parentId,values",*/
		user: "id,username,avatar"
	}, function(e, resp) {
		if (!e) {
			if (id == 0)
				var category = $.Entity.categoryMap[0]
			else
				category = resp.Cmain[0]
			callback(category, resp.category, resp.content, resp.Ppinned)
		} else {
			callback(null)
		}
	}, true)
},

sendMessage: function(room, message, meta, callback) {
	return request("Comment", 'POST', callback, {parentId: room, content: JSON.stringify(meta)+"\n"+message})
},

doListenInitial: function(callback) {
	return read([
		//"systemaggregate",
		{comment:{reverse:true,limit:20}},
		{activity:{reverse:true,limit:10}},
		{activityaggregate:{reverse:true,limit:10}},
		"content.0parentId.1contentId.0id", //pages
		"category.1contentId",
		"user.0createUserId.1userId.2userIds", //users for comment and activity
	],{content:"id,createUserId,name,permissions"},callback)
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
		content: "id,createUserId,name,permissions"
	}, callback)
},

lpRefresh: function() {
	if (lpRunning) {
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
			onMessages(resp.chains.comment)
		if (resp.chains.commentdelete)
			onMessages(resp.chains.commentdelete)
		if (resp.chains.activity)
			onActivity(resp.chains.activity)
	}
},

lpLoop: function(noCancel) {
	lpRunning = true
	//make sure only one instance of this is running
	var cancelled
	var x = doListen(lpLastId, lpStatuses, lpLastListeners, noCancel, function(e, resp) {
		if (noCancel)
			noCancel(e, resp)
		if (cancelled) { // should never happen (but I think it does sometimes..)
			console.log("OH HECK")
			return
		}
		// try/catch here so the long poller won't fail when there's an error in the callbacks
		try {
			lpLastId = resp.lastId
			if (resp.listeners)
				lpLastListeners = resp.listeners
			lpProcess(resp)
		} catch (e) {
			console.error(e)
		}
		if (!e || e=='timeout' || e=='rate') {
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
		if (noCancel)
			return
		cancelled = true
		lpRunning = false
		x.abort()
	}
},

lpSetListening: function(ids) {
	var newListeners = {"-1":lpLastListeners[-1]}
	ids.forEach(function(id) {
		newListeners[id] = lpLastListeners[id] || {"0":""}
	})
	lpLastListeners = newListeners
},

fileURL: function(id, query) {
	if (query)
		return server+"/File/raw/"+id+"?"+query
	return server+"/File/raw/"+id
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
	if (i<0)
		array.push(value)
	else
		array.splice(i, 1)
}

if ($.location.protocol=="http:")
	protocol = "http:"
else
	protocol = "https:"
server = protocol+"//newdev.smilebasicsource.com/api"

<!--/*
}(window)) //*/
