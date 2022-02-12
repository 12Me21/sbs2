function arrayToggle(array, value) {
	let i = array.indexOf(value)
	if (i<0) {
		array.push(value)
		return true
	}
	array.splice(i, 1)
	return false
}

const Req = {
	//storageKey = "devauth"
	storageKey: "auth",
	
	auth: null,
	onLogin: null,
	onLogout: null,
	onGuestLoad: null,
	
	server: "smilebasicsource.com/api",
	
	uid: null,
	
	categoryTree: null,
	gotCategoryTree: false,
	
	me: null,
	
	locked: true,
	
	rawRequest(url, method, callback, data, auth) {
		let x = new XMLHttpRequest()
		x.open(method, url)
		let args = arguments
		
		let start = Date.now()
		
		let retry = (time, reason)=>{
			// this is not recursion because retry is called in async callback functions only!
			if (time) {
				console.log("will retry", reason, "in "+time/1000+" sec")
				if (time > 2000)
					try {
						Sidebar.print("Warning: request was rate limited with extremely long wait time: "+time/1000+" seconds")
					} catch(e) {}
				let id = setTimeout(()=>{retry(null, reason)}, time)
				x.abort = ()=>{clearTimeout(id)}
			} else {
				console.log("retrying request", reason)
				x.abort = rawRequest.apply(null, args).abort
			}
		}
		
		x.onload = ()=>{
			let type = x.getResponseHeader('Content-Type')
			let resp
			if (/^application\/json(?!=\w)/.test(type))
				resp = JSON.safeParse(x.responseText)
			else
				resp = x.responseText
			let code = x.status
			
			if (code==200) //this should maybe check other 2xx responses, but I think 204 is (was?) used for timeouts...
				callback(null, resp)
			else if (code==502)
				retry(5000, 'bad gateway')
			else if (code==408 || code==204 || code==524)
				// record says server uses 408, testing showed only 204. idk
				retry(null, 'timeout')
			else if (code == 429) { // rate limit
				let after = +(x.getResponseHeader('Retry-After') || 1)
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
		x.onerror = ()=>{
			let time = Date.now()-start
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
	},
	
	sendResetEmail(email, callback) {
		return this.request("User/passwordreset/sendemail", "POST", callback, {email: email})
	},
	
	resetPassword(key, password, callback) {
		return this.request("User/passwordreset", "POST", callback, {resetKey: key, password: password})
	},
	
	queryString(obj) {
		if (!obj)
			return ""
		let params = []
		for (let key in obj) {
			let val = obj[key]
			if (val === undefined)
				continue
			let item = encodeURIComponent(key)+"="
			// array items are encoded as
			// ids:[1,2,3] -> ids=1&ids=2&ids=3
			if (val instanceof Array)
				val.forEach(x => params.push(item+encodeURIComponent(x)))
			// otherwise, key=value
			else
				params.push(item+encodeURIComponent(val))
		}
		if (!params.length)
			return ""
		return "?"+params.join("&")
	},
	// idk having all brackets bold + dimgray was kinda nice...
	request(url, method, callback, data) {
		return this.rawRequest("https://"+this.server+"/"+url, method, (e, resp)=>{
			if (e == 'auth')
				this.logOut()
			else
				callback(e, resp)
		}, data, this.auth)
	},
	// logs the user out and clears the cached token
	logOut() {
		Store.remove(this.storageKey)
		Lp.lpStop()
		this.auth = null
		this.onLogout()
	},
	// call to set the current auth token
	// should only be called once (triggers login event)
	gotAuth(newAuth) {
		let newUid
		try {
			newUid = Number(JSON.parse(window.atob(newAuth.split(".")[1])).uid) //yeah
		} catch(e) {
			this.logOut()
			return false
		}
		this.auth = newAuth
		this.uid = newUid
		this.onLogin()
		return true
	},
	
	authenticate(username, password, callback) {
		return this.request("User/authenticate", 'POST', (e, resp)=>{
			if (!e) {
				this.gotAuth(resp)
				Store.set(this.storageKey, resp, true)
			}
			callback(e, resp)
		}, {username: username, password: password})
	},
	
	// try to load cached auth token from localstorage
	// triggers onLogin and returns true if successful
	// (doesn't check if auth is expired though)
	// return: Boolean
	tryLoadCachedAuth() {
		let auth = Store.get(this.storageKey)
		let ok = auth ? this.gotAuth(auth) : false
		if (!ok)
			this.onGuestLoad()
		return ok
	},
	
	putFile(file, callback) {
		return this.request("File/"+file.id, 'PUT', callback, file)
	},
	
	register(username, password, email, callback) {
		return this.request("User/register", 'POST', callback, {
			username: username,
			password: password,
			email: email
		})
	},
	
	confirmRegister(key, callback) {
		return this.request("User/register/confirm", 'POST', callback, {
			confirmationKey: key
		})
	},
	
	sendEmail(email, callback) {
		return this.request("User/register/sendemail", 'POST', callback, {email: email})
	},
	
	read(requests, filters, callback, needCategories) {
		let query = {}
		query.requests = requests.map((req)=>{
			// `req` will either be:
			// string: "type"
			// object: {type: value}
			if (typeof req == 'string')
				return req
			else
				for (let type in req) //get first key
					return type+"-"+JSON.stringify(req[type])
		})
		Object.assign(query, filters)
		needCategories = needCategories && !this.gotCategoryTree
		if (needCategories)
			query.requests.push('category~Ctree')
		return this.request("Read/chain"+this.queryString(query), 'GET', (e, resp)=>{
			if (!e) {
				Entity.process(resp)
				if (needCategories)
					this.gotCategoryTree = true
			}
			callback(e, resp)
		})
	},
	
	getMe(callback) {
		return this.request("User/me", 'GET', (e, resp)=>{
			if (!e) {
				let l = [resp]
				Entity.processList('user',l,{})
				callback(l[0])
			} else
				callback(null)
		})
	},
	
	setBasic(data, callback) {
		return this.request("User/basic", 'PUT', (e, resp)=>{
			if (!e) {
				let l = [resp]
				Entity.processList('user',l,{})
				callback(l[0])
			} else
				callback(null)
		}, data)
	},
	
	setSensitive(data, callback) {
		return this,request("User/sensitive", 'POST', callback, data)
	},
	
	// this should accept as many types as possible
	uploadImage(thing, callback) {
		if (thing instanceof HTMLCanvasElement) {
			thing.toBlob((blob)=>{
				if (blob)
					this.uploadFile(blob, callback)
				else
					callback(null)
			})
		} else if (thing instanceof File || thing instanceof Blob) {
			this.uploadFile(thing, callback)
		} else if (thing instanceof Image) {
			this.callback(null)
			// todo
		} else {
			this.callback(null)
		}
	},
	
	uploadFile(file, callback) {
		let form = new FormData()
		form.append('file', file)
		let params = {}
		// todo: should these check for falsey or null?
		if (file.bucket) params.bucket = file.bucket
		if (file.quantize) params.quantize = file.quantize
		if (file.name) params.name = file.filename
		params.tryresize = true
		
		this.request("File"+this.queryString(params), 'POST', (e, resp)=>{
			if (e)
				callback(null)
			else {
				let l = [resp]
				Entity.processList('file',l,{})
				callback(l[0])
			}
		}, form)
	},
	
	toggleHiding(id, callback) {
		return this.getMe((me)=>{
			if (me) {
				let hiding = me.hidelist
				let hidden = arrayToggle(hiding, id)
				this.setBasic({hidelist:hiding}, (e)=>{
					if (e)
						callback(null)
					else
						callback(hidden)
				})
			} else
				callback(null)
		})
	},
	
	getCategories(callback) {
		return this.read([], {}, callback, true)
	},
	
	searchUsers(text, callback) {
		let like = text.replace(/%/g,"_") //the best we can do...
		let count = 20
		return this.read([
			{user: {limit: count, usernameLike: "%"+like+"%", sort: 'editDate', reverse: true}}
		],{},(e, resp)=>{
			if (!e)
				callback(resp.userMap)
			else
				callback(null)
		})
	},
	
	search1(text, callback) {
		let like = text.replace(/%/g,"_") //the best we can do...
		let count = 20
		let page = 0
		page = page*count
		return this.read([
			{"user~Usearch": {limit: count, skip: page, usernameLike: like+"%"}}, 
			{content: {limit: count, skip: page, nameLike: "%"+like+"%"}},
			{content: {limit: count, skip: page, keyword: like}},
			"user.1createUserId.2createUserId"
		],{
			content: "name,id,type,permissions,createUserId" //eh
		}, (e, resp)=>{
			if (!e)
				callback(resp.Usearch, resp.content)
			else
				callback(null)
		})
	},
	
	getRecentActivity(callback) {
		let day = 1000*60*60*24
		let start = new Date(Date.now() - day).toISOString()
		// "except no that won't work if site dies lol"
		return this.read([
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
	
	setVote(id, state, callback) {
		return this.request("Vote/"+id+"/"+(state||"delete"), 'POST', callback)
	},
	
	editPage(page, callback) {
		if (locked)
			callback(null)
		if (page.id)
			this.request("Content/"+page.id, 'PUT', callback, page)
		else
			this.request("Content", 'POST', callback, page)
	},
	
	getComment(id, callback) {
		return this.read([
			{comment: {ids: [id]}} //todo: maybe also get page permissions?
		], {}, (e, resp)=>{
			if (!e)
				callback(resp.comment[0])
			else
				callback(null)
		})
	},
	
	getCommentsBefore(id, firstId, count, callback) {
		let fi = {reverse: true, limit: count, parentIds: [id]}
		if (firstId != null)
			fi.maxId = firstId // maxId is EXCLUSIVE
		return this.read([
			{comment: fi},
			"user.0createUserId.0editUserId",
		], {}, (e, resp)=>{
			if (!e)
				callback(resp.comment)
			else
				callback(null)
		})
	},
	
	getCommentsAfter(id, lastId, count, callback) {
		let fi = {limit: count, parentIds: [id]}
		if (lastId != null)
			fi.minId = lastId
		return this.read([
			{comment: fi},
			"user.0createUserId.0editUserId",
		], {}, (e, resp)=>{
			if (!e)
				callback(resp.comment)
			else
				callback(null)
		})
	},
	
	sendMessage(room, message, meta, callback) {
		return this.request("Comment", 'POST', callback, {parentId: room, content: JSON.stringify(meta)+"\n"+message})
	},
	
	editMessage(id, room, message, meta, callback) {
		return this.request("Comment/"+id, 'PUT', callback, {parentId: room, content: JSON.stringify(meta)+"\n"+message})
	},
	
	deleteMessage(id, callback) {
		return this.request("Comment/"+id+"/delete", 'POST', callback)
	},
	
	fileURL(id, query) {
		if (query)
			return "https://"+this.server+"/File/raw/"+id+"?"+query
		return "https://"+this.server+"/File/raw/"+id
	},
}

if (0)
	server = protocol+"//newdev.smilebasicsource.com/api"
