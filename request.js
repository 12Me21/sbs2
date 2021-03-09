<!--/* trick indenter
window.Req = Object.create(null)
with (Req) (function($) { "use strict"
Object.assign(Req, { //*/

/*
storageKey: "devauth",
*/
storageKey: "auth",

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
			console.warn('got 500 error', x, resp)
			retry(1000, '500 error')
		} else { // other
			alert("Request failed! "+code+" "+url)
			console.log("REQUEST FAILED", x)
			resp = JSON.safeParse(resp)
			callback('error', resp, code)
		}
	}
	x.onerror = function() {
		print("Request failed!")
		var time = Date.now()-start
		//console.log("xhr onerror after ms:"+time)
		if (time > 18*1000)
			retry(null, "3ds timeout")
		else
			retry(5000, "request error")
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
	return rawRequest(server+"/"+url, method, function(e, resp) {
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
	var end = new Date(Date.now()).toISOString()
	return read([
		{activity: {createStart: start, createEnd: end}},
		{commentaggregate: {createStart: start, createEnd: end}},
		{"activity~Awatching": {contentLimit:{watches:true}}},
		{"commentaggregate~CAwatching": {contentLimit:{watches:true}}},
		"content.0contentId.1id.2contentId.3id",
		{comment: {limit: 30, reverse: true}},
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
		fi.minId = lastId+1
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
		// try/catch here so the long poller won't fail when there's an error in the callbacks
		try {
			lpLastId = resp.lastId
			if (resp.listeners)
				lpLastListeners = resp.listeners
			lpProcess(resp)
		} catch (e) {
			console.error(e)
		}
		if (!e) {
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
	if (i<0) {
		array.push(value)
		return true
	}
	array.splice(i, 1)
	return false
}

if ($.location.protocol=="http:")
	protocol = "http:"
else
	protocol = "https:"
//this is to trick a script
server = protocol+"//newdev.smilebasicsource.com/api"
server = protocol+"//smilebasicsource.com/api"

<!--/*
}(window)) //*/
