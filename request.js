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
			callback('timeout', resp)
		} else if (code == 429) { // rate limit
			$.setTimeout(function() {
				callback('rate', resp)
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
		$.console.log("xhr onerror after ms:"+time)
		if (time > 18*1000) {
			$.console.log("detected 3DS timeout")
			callback('timeout')
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
	$.localStorage.removeItem(storageKey)
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
			$.localStorage.setItem(storageKey, resp, true)
		}
		callback(e, resp)
	}, {username: username, password: password})
},

// try to load cached auth token from localstorage
// triggers onLogin and returns true if successful
// (doesn't check if auth is expired though)
tryLoadCachedAuth: function() {
	var auth = $.localStorage.getItem(storageKey)
	if (auth)
		return gotAuth(auth)
	return false
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

getCategories: function(callback) {
	return read([],{},callback,true)
},

getUserView: function(id, callback) {
	return read([
		{user: {ids: [id]}},
		{"content~Puserpage": {createUserIds: [id], type: '@user.page', limit: 1}},
		{activity: {userIds: [id], limit: 20, reverse: true}},
		{commentaggregate: {userIds: [id], limit: 100, reverse: true}},
		"content.2contentId.3id"
	],{},function(e, resp) {
		if (!e) {
			var user = resp.userMap[id]
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

getChatView: function(id, callback) {
	return read([
		{content: {ids: [id]}},
		{comment: {parentIds: [id], limit: 50, reverse: true}},
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

getPageView: function(id, callback) {
	return read([
		{content: {ids: [+id]}},
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

fileURL: function(id, query) {
	if (query)
		return server+"/File/raw/"+id+"?"+query
	return server+"/File/raw/"+id
}

<!--/* 
}) //*/

if ($.location.protocol=="http:")
	protocol = "http:"
else
	protocol = "https:"
server = protocol+"//newdev.smilebasicsource.com/api"

<!--/*
}(window)) //*/
