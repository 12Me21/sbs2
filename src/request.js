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
	Lp.stop()
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
		{"comment~Mall": {reverse: true, limit: 1000}},
		{"activity~Awatching": {contentLimit:{watches:true}}},
		"content.0contentId.1parentId.2contentId",
		{comment: {limit: 50, reverse: true, createStart: start}},
		"user.0userId.1editUserId.2userId.4createUserId",
	], {
		content: "name,id,permissions,type",
		Mall: "parentId,editUserId,editDate"
	}, callback)
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

fileURL: function(id, query) {
	if (query)
		return "https://"+server+"/File/raw/"+id+"?"+query
	return "https://"+server+"/File/raw/"+id
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
