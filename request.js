<!--/* trick indenter
		 var Req = (function(){ //*/
var $ = {}

var storageKey = "devauth"

if (window.location.protocol=="http:")
	var protocol = "http:"
else
	protocol = "https:"

$.auth = null
$.onLogin = null
$.onLogout = null

$.server = protocol+"//newdev.smilebasicsource.com/api"

function rawRequest(url, method, callback, data, auth){
	var x = new XMLHttpRequest()
	x.open(method, url)

	var start = Date.now()
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
			window.setTimeout(function() {
				callback('rate', resp)
			}, 1000)
		} else if (code==401 || code==403) {
			callback('auth', resp)
		} else if (code==404) {
			callback('404', resp)
		} else if (ignore400 && code==400) {
			try {
				resp = JSON.parse(resp)
			} catch(e) {
			}
			callback('error', resp)
		} else {
			alert("Request failed! "+code+" "+url)
			//console.log("sbs2Request: request failed! "+code)
			//console.log(x.responseText)
			console.log("REQUEST FAILED", x)
			try {
				resp = JSON.parse(resp)
			} catch(e) {
			}
			callback('error', resp, code)
		}
	}
	x.onerror = function() {
		var time = Date.now()-start
		console.log("xhr onerror after ms:"+time)
		if (time > 18*1000) {
			console.log("detected 3DS timeout")
			callback('timeout')
		} else {
			alert("Request failed! "+url)
			console.log("xhr onerror")
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
}

function queryString(obj) {
	if (!obj)
		return ""
	var items = []
	for (var key in obj) {
		var val = obj[key]
		if (typeof val != 'undefined'){
			var item = encodeURIComponent(key)+"="
			// array items are encoded as
			// ids:[1,2,3] -> ids=1&ids=2&ids=3
			if (val instanceof Array) {
				for(var i=0;i<val.length;i++){
					items.push(item+encodeURIComponent(val[i]))
				}
			// otherwise, key=value
			} else {
				items.push(item+encodeURIComponent(val))
			}
		}
	}
	
	if (items.length)
		return "?"+items.join("&")
	else
		return ""
}

$.request = function(url, method, callback, data) {
	return rawRequest($server+"/"+url, method, function(e, resp) {
		if (e == 'auth')
			$.logOut()
		else
			callback(e, resp)
	}, data, $.auth)
}

// logs the user out and clears the cached token
$.logOut = function() {
	localStorage.removeItem(storageKey)
	$.auth = null
	$.onLogout()
}

// call to set the current auth token
// should only be called once (triggers login event)
function gotAuth(newAuth) {
	try {
		var newUid = JSON.parse(atob(newAuth.split(".")[1])).uid
		$.auth = newAuth
		$.uid = newUid
		$.onLogin()
		return true
	} catch(e) {
		$.logOut()
		return false
	}
}

$.authenticate = function(username, password, callback) {
	return request("User/authenticate", 'POST', function(e, resp) {
		if (!e) {
			gotAuth(resp)
			localStorage.setItem(storageKey, resp, true)
		}
		callback(e, resp)
	}, {username: username, password: password})
}

// try to load cached auth token from localstorage
// triggers onLogin and returns true if successful
// (doesn't check if auth is expired though)
$.tryLoadCachedAuth = function() {
	var auth = localStorage.getItem(storageKey)
	if (auth)
		return gotAuth(auth)
	return false
}

return $
})()
