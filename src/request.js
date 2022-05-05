// todo: how much can we track the request?
// we probably only see anything once the main response is sent (i.e. after the cors preflight finishes) but that still might be a second before completion


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

// this class seemed clever at the time (and IS) but idk it's kinda gross...
class ApiRequest extends XMLHttpRequest {
	constructor(url, method, body, proc, ok=console.info, fail) {
		super()
		super.onreadystatechange = this.onreadystatechange
		
		this.url = url
		this.method = method
		this.body = body
		
		this.proc = proc
		
		this.ok = ok
		this.onerror = fail
		
		this.go()
	}
	fail(...e) {
		console.error("request error:", ...e)
		if (this.onerror)
			this.onerror(...e)
	}
	go() {
		this.open(this.method, `https://${Req.server}/${this.url}`)
		this.setRequestHeader('CACHE-CONTROL', "L, ratio, no-store, no-cache, must-revalidate") // we probably only need no-store here
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
			let resp = this.response // json or text
			
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
				// todo: maybe have some way to trigger a retry here?
			case 502:
				return this.retry(5000, 'bad gateway')
			case 408: case 204: case 524:
				return this.retry(0, 'timeout')
			case 429:
				let after = +(this.getResponseHeader('Retry-After') || 1)
				return this.retry((after+0.5)*1000, `rate limited ${after}sec`)
			// === Permissions ===
			case 403:
				return this.fail('permission', resp) // todo: can these be InvalidRequestError as well?
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
				alert(`Request failed! ${this.status} ${this.url}`)
				console.log("REQUEST FAILED", this)
				return this.fail('error', resp, this.status)
			}
		}
	}
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
	
	//idea: keep track of whether an object was requested with fields=*, and prevent posting it otherwise
	
	// idk having all brackets bold + dimgray was kinda nice...
	// i dont like how proc is required but h
	
	// request(url, proc) - GET
	// request(url, proc, null) - POST
	// request(url, proc, data) - POST
	
	request(url, proc, data) {
		let method = 'GET'
		if (data !== undefined) {
			method = 'POST'
			if (data != null)
				data = JSON.to_blob(data)
		}
		return ApiRequest.bind(null, url, method, data, proc)
	},
	
	// idea: function.valueOf calls the function and returns um ..   something.. .chaining .. mmmm
	
	chain(data) {
		return ApiRequest.bind(
			null, 'request', 'POST',
			JSON.to_blob(data), resp=>Entity.do_listmap(resp.objects))
	},
	
	/////////////////////////
	//                     //
	/////////////////////////
	
	// log in using username/password
	get_auth(username, password) {
		return this.request('User/login', null, {username, password})
	},
	
	// logs the user out and clears the cached token
	log_out() {
		Store.remove(this.storage_key)
		this.auth = null
		Lp.stop()
		window.alert("logged out")
		View.flag('loggedIn', false)
	},
	
	// try to load cached auth token from localstorage
	// (doesn't check if auth is expired though)
	// also doesn't DO anything else. (important, can be called at time 0)
	// return: Boolean
	try_load_auth() {
		try {
			this.auth = Store.get(this.storage_key)
			if (!this.auth)
				throw "no auth token in localstorage"
			let data = JSON.parse(window.atob(this.auth.split(".")[1]))//yeah
			this.uid = +data.uid
			if (!this.uid)
				throw "couldn't find uid"
			//let expire = data.exp
			//if (expire && Date.now()/1000>=expire) ;
			return true
		} catch(e) {
			this.auth = this.uid = null
			return false
		}
	},
	
	save_auth(token) {
		Store.set(this.storage_key, token)
	},
	
	// messages
	send_message(message) {
		return this.request('Write/message', null, message)
	},
	delete_message(id) {
		return this.request(`Delete/message/${id}`, null, null)
	},
	
	file_url(id, query) {
		if (query)
			return `https://${this.server}/File/raw/${id}?${query}`
		return `https://${this.server}/File/raw/${id}`
	},
	
	upload_file(file, params) {
		let form = new FormData()
		form.set('file', file)
		function set(name, value) {
			if (value==="")
				console.warn(`form[‘${name}’]: empty string will be treated as null`)
			form.set(name, value)
		}
		for (let name in params) {
			let value = params[name]
			if (name=='values')
				for (let name in value)
					set(`values[${name}]`, value[name])
			else {
				if (name=='globalPerms' && value==="")
					value="."
				set(name, value)
			}
		}
		return ApiRequest.bind(null, 'File', 'POST', form, TYPES.content)
	},
}
Object.seal(Req)
