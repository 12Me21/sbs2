class InvalidRequestError extends TypeError {
	constructor(url, data, resp) {
		super()
		this.trim_stack(1)
		this.resp = resp
		this.name = "400 ➡️ "+url
	}
	get message() {
		let lines = []
		if (!this.resp)
			lines.push("???")
		if (this.resp.title)
			lines.push(this.resp.title)
		if (this.resp.errors)
			Object.for(this.resp.errors, (msg,key)=>{
				lines.push(`❌${key}:`)
				lines.push(...msg.map(x=>` 🔸${x}`))
			})
		Object.defineProperty(this, 'message', {
			value: "\n"+lines.join("\n")
		})
		return this.message
	}
}
InvalidRequestError.prototype.name = "InvalidRequestError"

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
	server: "qcs.shsbs.xyz/api",
	get storage_key() {
		return `token-${this.server}`
	},
	
	auth: null,
	uid: null,
	me: null,
	
	locked: false, // for testing
	
	// `proc` is a function that gets called after the data is recieved
	// of course, you could handle this in the `ok` callback, but then
	// you're forced to intercept this before passing the data to 
	// a higher level function
	raw_request(url, method, data, etc, ok, fail) {
		let x = new XMLHttpRequest()
		x.open(method, `https://${this.server}/${url}`)
		let start = Date.now()
		
		let aborted // just in case
		if (etc.abort)
			etc.abort[0] = ()=>{
				aborted = true
				x.abort()
			}
		
		let retry = (time, reason)=>{
			console.log("will retry", reason, "in "+time/1000+" sec")
			if (time > 2000)
				print("Warning: request was rate limited with extremely long wait time: "+time/1000+" seconds")
			let id = window.setTimeout(()=>{
				if (aborted)
					return
				console.log("retrying request", reason)
				// this is not recursion: we're in an async callback function!
				this.raw_request(url, method, data, etc, ok, fail)
			}, time)
			x.abort = window.clearTimeout.bind(window, id)
		}
		
		x.onload = ()=>{
			if (aborted)
				return
			
			let type = x.getResponseHeader('Content-Type')
			let resp = x.responseText
			if (/^application\/(\w+\+)?json\b/i.test(type))
				resp = JSON.safe_parse(resp)
			let code = x.status
			
			if (code==200) {
				if (etc.proc)
					resp = etc.proc(resp)
				return ok(resp)
			}
			
			if (code==502) return retry(5000, 'bad gateway')
			// (record says server uses 408, testing showed only 204. idk)
			if (code==408 || code==204 || code==524) return retry(0, 'timeout')
			if (code==429) {
				let after = +(x.getResponseHeader('Retry-After') || 1)
				return retry((after+0.5)*1000, "rate limited "+after+"sec")
			}
			
			if (code==403) return fail('permission', resp)
			if (code==404) return fail('404', resp)
			if (code==418) return fail('ban', resp)
			if (code==400) {
				return fail('error', new InvalidRequestError(url, data, resp))
			}
			if (code==401) {
				alert("AUTHENTICATION ERROR!?\nif this is real, you must log out!\n"+resp)
				// todo: let the user log in with the sidebar, without calling log_out, so the page only reloads once instead of twice
				// this.log_out()
				return fail('auth', resp)
			}
			if (code==500) {
				console.error('got 500 error', x, resp)
				return fail('error', JSON.safe_parse(resp))
			}
			alert("Request failed! "+code+" "+url)
			console.log("REQUEST FAILED", x)
			return fail('error', resp, code)
		}
		
		x.onerror = ()=>{
			if (aborted)
				return
			
			let time = Date.now()-start
			if (time > 18*1000) // i think other browsers do this too now?
				return retry(0, "3ds timeout")
			print("Request failed!")
			return retry(5000, "request error")
		}
		x.setRequestHeader('CACHE-CONTROL', "L, ratio, no-store, no-cache, must-revalidate")
		this.auth && x.setRequestHeader('AUTHORIZATION', "Bearer "+this.auth)
		x.send(data)
	},
	
	query_string(obj) {
		if (!obj)
			return ""
		let params = []
		for (let [key, val] of Object.entries(obj)) {
			if (val == undefined)
				continue
			let item = window.encodeURIComponent(key)+"="
			// array items are encoded as
			// ids:[1,2,3] -> ids=1&ids=2&ids=3
			if (val instanceof Array)
				for (let x of val)
					params.push(item+window.encodeURIComponent(x))
			// otherwise, key=value
			else
				params.push(item+window.encodeURIComponent(val))
		}
		if (!params.length)
			return ""
		return "?"+params.join("&")
	},
	
	// idk having all brackets bold + dimgray was kinda nice...
	// i dont like how proc is required but h
	request(url, proc, data) {
		if (Object.is_plain(data))
			data = JSON.to_blob(data)
		let method = data===undefined ? 'GET' : 'POST'
		return this.raw_request.bind(this, url, method, data, {proc})
	},
	// idea: function.valueOf calls the function and returns um ..   something.. .chaining .. mmmm
	
	chain(data, abort=null) {
		return this.raw_request.bind(this, 'request', 'POST', JSON.to_blob(data), {proc: resp=>Entity.process(resp.data), abort})
	},
	
	/////////////////////////
	//                     //
	/////////////////////////
	
	// logs the user out and clears the cached token
	log_out() {
		Store.remove(this.storage_key)
		window.location.reload()
		Lp.stop()
		this.auth = null
	},
	
	// log in using username/password
	log_in(username, password) {
		return this.request('User/login', null, {username, password})
	},
	
	// try to load cached auth token from localstorage
	// (doesn't check if auth is expired though)
	// also doesn't DO anything else. (important, can be called at time 0)
	// return: Boolean
	try_load_auth() {
		let auth, uid
		try {
			auth = Store.get(this.storage_key)
			uid = +JSON.parse(window.atob(auth.split(".")[1])).uid //yeah
		} catch(e) {
		}
		if (auth && uid) {
			this.auth = auth
			this.uid = uid
			return true
		}
		this.auth = null
		this.uid = null
		return false
	},
	
	get_me() {
		// todo: instead of the proc function,
		// we can just tell it what type of data to expect
		// this will just be like either
		// a single entity, or ws response, or api/request response
		return this.request("User/me", Entity.process_item.bind(Entity, 'user'))
	},
	
	set_basic(data) {
		return this.request2("User/basic", Entity.process_item.bind(Entity, 'user'), 'PUT', data)
		// maybe it would be better to just pass the typename or something here? instead of entity.whatever
	},
	
	set_sensitive(data) {
		return this.request2("User/sensitive", null, 'POST', data)
	},
	
	put_file(file) {
		return this.request2("File/"+file.id, null, 'PUT', file)
	},
	
	upload_file(file, params) {
		let form = new FormData() // no you can't just pass fields to the constructor
		form.append('file', file)
		return this.request2("File"+this.query_string(params), Entity.process_item.bind(Entity, 'file'), 'POST', form)
	},
	
	toggle_hiding(id, callback) {
		this.get_me().then((me)=>{
			let hiding = me.hidelist
			let hidden = arrayToggle(hiding, id)
			this.set_basic({hidelist:hiding}).then(()=>{
				callback(hidden)
			})
		})
	},
	
	searchUsers(text) {
		let like = text.replace(/%/g,"_") //the best we can do...
		let count = 20
		return this.chain([
			['user', {limit: count, usernameLike: "%"+like+"%", sort: 'editDate', reverse: true}]
		])
	},
	
	search1(text) {
		let like = text.replace(/%/g,"_") //the best we can do...
		let count = 20
		let page = 0
		page = page*count
		return this.chain([
			['user~Usearch', {limit: count, skip: page, usernameLike: like+"%"}],
			['content', {limit: count, skip: page, nameLike: "%"+like+"%"}],
			['content', {limit: count, skip: page, keyword: like}],
			['user.1createUserId.2createUserId'],
		], {
			content: 'name,id,type,permissions,createUserId', //eh
		})
	},
	
	setVote(id, state) {
		return this.request2("Vote/"+id+"/"+(state||"delete"), null, 'POST', null)
	},
	
	editPage(page) {
		if (this.locked) {
			console.log("editing page:", page)
			return
		}
		if (page.id)
			return this.request2("Content/"+page.id, null, 'PUT', page)
		else
			return this.request2("Content", null, 'POST', page)
	},
	
	get_older_comments(pid, firstId, count) {
		let fi = {reverse: true, limit: count, parentIds: [pid]}
		if (firstId != null)
			fi.maxId = firstId // maxId is EXCLUSIVE
		return this.chain([
			['comment', fi],
			['user.0createUserId.0editUserId'],
		])
	},
	
	get_newer_comments(pid, lastId, count) {
		let fi = {limit: count, parentIds: [pid]}
		if (lastId != null) // isn't it fine if we just pass null though?
			fi.minId = lastId
		return this.chain([
			['comment', fi],
			['user.0createUserId.0editUserId'],
		])
	},
	
	send_message(room, text, meta) {
		return this.request2("Comment", null, 'POST', {parentId: room, content: Entity.encode_comment(text, meta)})
	},
	
	edit_message(id, room, text, meta) { // lots of args..
		return this.request2("Comment/"+id, null, 'PUT', {parentId: room, content: Entity.encode_comment(text, meta)})
	},
	
	delete_message(id) {
		return this.request2("Comment/"+id+"/delete", null, 'POST', null)
	},
	
	file_url(id, query) {
		if (query)
			return `https://${this.server}/File/raw/${id}?${query}`
		return `https://${this.server}/File/raw/${id}`
	},
}
Object.seal(Req)

if (0)
	server = protocol+"//newdev.smilebasicsource.com/api"
