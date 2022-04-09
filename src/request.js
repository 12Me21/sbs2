class InvalidRequestError extends TypeError {
	constructor(apir) {
		super()
		this.trim_stack()
		
		this.resp = apir.response
		this.url = apir.url
		this.code = apir.status
		
		this.name = `${this.code} ➡️ api╱${this.url}`
		//this.body = apir.body
	}
	get message() {
		if (typeof this.resp == 'string')
			return "\n"+this.resp
		let lines = [""]
		if (!this.resp)
			lines.push("???")
		if (this.resp.title)
			lines.push(this.resp.title)
		if (this.resp.errors)
			Object.for(this.resp.errors, (msg,key)=>{
				lines.push(`❌${key}:`)
				lines.push(...msg.map(x=>` 🔸${x}`))
			})
		return lines.join("\n")
	}
}
InvalidRequestError.prototype.name = "InvalidRequestError"

class ApiRequest extends XMLHttpRequest {
	constructor(url, method, body, etc, ok=console.info, fail=Unhandled_Callback) {
		super()
		super.onreadystatechange = this.onreadystatechange
		
		this.url = url
		this.method = method
		this.body = body
		
		this.proc = etc.proc
		
		this.ok = ok
		this.fail = fail
		
		this.go()
	}
	go() {
		this.open(this.method, `https://${Req.server}/${this.url}`)
		this.setRequestHeader('CACHE-CONTROL', "L, ratio, no-store, no-cache, must-revalidate")
		if (Req.auth)
			this.setRequestHeader('AUTHORIZATION', "Bearer "+Req.auth)
		this.send(this.body)
	}
	abort() {
		super.abort()
		this.aborted = true
	}
	retry(time, reason) {
		console.log(`will retry ${reason} in ${time/1000} sec`)
		if (time > 2000)
			print(`Warning: request was rate limited with extremely long wait time: ${time/1000} seconds`)
		let id = window.setTimeout(()=>{
			if (this.aborted) return
			console.log("retrying request", reason)
			this.go()
		}, time)
	}
	onreadystatechange() {
		if (this.aborted) return
		
		switch (this.readyState) {
		case XMLHttpRequest.HEADERS_RECEIVED:
			let type = this.getResponseHeader('Content-Type')
			if (/[/+]json(;| |$)/i.test(type))
				this.responseType = 'json'
			return
			
		case XMLHttpRequest.DONE:
			let resp = this.response
			
			switch (this.status) {
			// === Success ===
			case 200:
				if (this.proc)
					resp = this.proc(resp)
				return this.ok(resp)
			// === Invalid request ===
			case 400: case 415: case 404: case 500:
				return this.fail(new InvalidRequestError(this))
			// === Network Conditions ===
			case 0:
				print("Request failed!")
				return this.fail('connection')
			case 502:
				return this.retry(5000, 'bad gateway')
			case 408: case 204: case 524:
				return this.retry(0, 'timeout')
			case 429:
				let after = +(this.getResponseHeader('Retry-After') || 1)
				return this.retry((after+0.5)*1000, `rate limited ${after}sec`)
			// === Permissions ===
			case 403:
				return this.fail('permission', resp)
			case 418:
				return this.fail('ban', resp)
			case 401:
				alert(`AUTHENTICATION ERROR!?
if this is real, you must log out!
${resp}`)
				// todo: let the user log in with the sidebar, without calling log_out, so the page only reloads once instead of twice
				// this.log_out()
				return this.fail('auth', resp)
			// === ??? some other error ===
			default:
				alert(`Request failed! ${this.status} ${url}`)
				console.log("REQUEST FAILED", this)
				return this.fail('error', resp, this.status)
			}
		}
	}
}

function arrayToggle(array, value) {
	let i = array.indexOf(value)
	if (i<0) {
		array.push(value)
		return true
	}
	array.splice(i, 1)
	return false
}

function Unhandled_Callback(err, ...x) {
	console.error("Unhandled Callback\n", err, ...x);
}

const Req = { // this stuff can all be static methods on ApiRequest maybe?
	server: "qcs.shsbs.xyz/api",
//	server: "oboy.smilebasicsource.com/api",
	get storage_key() {
		return `token-${this.server}`
	},
	
	auth: null,
	uid: null,
	me: null,
	
	locked: false, // for testing
	
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
		if (Object.is_plain(data)) // todo: with custom classes this doesn't work. we need a better solution..
			data = JSON.to_blob(data)
		let method = data===undefined ? 'GET' : 'POST'
		return ApiRequest.bind(null, url, method, data, {proc})
	},
	// idea: function.valueOf calls the function and returns um ..   something.. .chaining .. mmmm
	
	chain(values, requests) {
		return ApiRequest.bind(null, 'request', 'POST', JSON.to_blob({values, requests}), {proc: resp=>Entity.process(resp.data)})
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
