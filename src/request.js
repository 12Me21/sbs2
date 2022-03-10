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
	auth: null,
	storage_key: "auth",
	
	server: "smilebasicsource.com/api", // no you can't add "https://" to this string, because we need to use wss:// in another place
	
	uid: null,
	
	me: null,
	
	locked: false, // for testing
	
	JSONData(obj) {
		return new Blob([JSON.stringify(obj)], {type: "application/json;charset=UTF-8"})
	},
	
	// `proc` is a function that gets called after the data is recieved
	// of course, you could handle this in the `ok` callback, but then
	// you're forced to intercept this before passing the data to 
	// a higher level function
	raw_request(url, method, data, proc, ok, fail) {
		let x = new XMLHttpRequest()
		x.open(method, `https://${this.server}/${url}`)
		let start = Date.now()
		
		let retry = (time, reason)=>{
			console.log("will retry", reason, "in "+time/1000+" sec")
			if (time > 2000)
				try { // messy. why don't we have a print func which never fails?
					print("Warning: request was rate limited with extremely long wait time: "+time/1000+" seconds")
				} catch(e) {}
			let id = window.setTimeout(()=>{
				console.log("retrying request", reason)
				// this is not recursion: we're in an async callback function!
				let x2 = this.raw_request(url, method, data, ok, fail)
				x.abort = x2.abort
			}, time)
			x.abort = ()=>{window.clearTimeout(id)}
		}
		
		x.onload = ()=>{
			let type = x.getResponseHeader('Content-Type')
			let resp = x.responseText
			if (/^application\/json\b/i.test(type))
				resp = JSON.safe_parse(resp)
			let code = x.status
			
			if (code==200) {
				if (proc)
					proc(resp)
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
			if (code==400) return fail('error', resp)
			if (code==401) {
				alert("AUTHENTICATION ERROR!?\nif this is real, you must log out!\n"+resp)
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
			let time = Date.now()-start
			if (time > 18*1000) // i think other browsers do this too now?
				return retry(0, "3ds timeout")
			print("Request failed!")
			return retry(5000, "request error")
		}
		
		x.setRequestHeader('Cache-Control', "no-store no-cache must-revalidate")
		this.auth && x.setRequestHeader('Authorization', "Bearer "+this.auth)
		x.send(data)
		
		// the only thing we use here is .abort
		// (note that .abort is modified by retry())
		return x
	},
	
	query_string(obj) {
		if (!obj)
			return ""
		let params = []
		for (let [key, val] of Object.entries(obj)) {
			if (val == undefined)
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
	
	is_object(data) {
		return data && Object.getPrototypeOf(data)==Object.prototype
	},
	
	// idk having all brackets bold + dimgray was kinda nice...
	request(url, method, callback, data) {
		if (this.is_object(data))
			data = this.JSONData(data)
		return this.raw_request(url, method, data, null, callback.bind(null, null), callback)
	},
	//
	request2(url, proc, method='GET', data=null) {
		if (this.is_object(data))
			data = this.JSONData(data)
		return new Promise(this.raw_request.bind(this, url, method, data, proc))
	},
	
	// new version of read()
	chain(requests, fields) {
		let query = {}
		query.requests = requests.map(([thing, data])=>{
			if (data)
				thing += "-"+JSON.stringify(data)
			return thing
		})
		if (fields)
			Object.assign(query, fields)
		return this.request2("Read/chain"+this.query_string(query), (resp)=>{
			Entity.process(resp)
		})
	},
	
	read(requests, filters, callback, first) {
		//let offset = null
		if (first) {
			requests = [
				...requests,
				['category~Ctree'],
			]
		}
		let query = {
			requests: requests.map(([thing, data])=>{
				// if we're injecting something at the start
				//if (offset)
				//	thing = thing.replace(/\d+/g, (d)=> +d + offset)
				
				if (data)
					thing += "-"+JSON.stringify(data)
				return thing
			}),
		}
		Object.assign(query, filters) // we're not ready for {...} syntax yet
		
		return this.request("Read/chain"+this.query_string(query), 'GET', (e, resp)=>{
			if (!e) {
				Entity.process(resp)
			}
			callback(e, resp, first && !e)
		})
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
	authenticate(username, password) {
		return this.request2('User/authenticate', null, 'POST', {username, password}).then(resp=>{
			Store.set(this.storage_key, resp, true)
			window.location.reload()
		})
	},
	
	// try to load cached auth token from localstorage
	// (doesn't check if auth is expired though)
	// also doesn't DO anything else. (important, can be called at time 0)
	// return: Boolean
	try_load_auth() {
		this.auth = null
		this.uid = null
		let auth = Store.get(this.storage_key)
		if (!auth)
			return false
		let uid
		try {
			uid = +JSON.parse(window.atob(auth.split(".")[1])).uid //yeah
		} catch(e) {
			return false
		}
		if (!uid)
			return false
		this.auth = auth
		this.uid = uid
		return true
	},
	
	get_initial(callback) {
		return this.read([
			['systemaggregate'], //~💖
			['user~Ume', {ids:[Req.uid], limit:1}],
		], {}, callback, false)
	},
	
	get_me(callback) {
		return this.request("User/me", 'GET', (e, resp)=>{
			if (!e) {
				let l = [resp]
				Entity.process_list('user',l,{})
				callback(l[0])
			} else
				callback(null)
		})
	},
	
	set_basic(data, callback) {
		return this.request("User/basic", 'PUT', (e, resp)=>{
			if (!e) {
				let l = [resp]
				Entity.process_list('user',l,{})
				callback(l[0])
			} else
				callback(null)
		}, data)
	},
	
	set_sensitive(data, callback) {
		return this.request("User/sensitive", 'POST', callback, data)
	},
	
	put_file(file, callback) {
		return this.request("File/"+file.id, 'PUT', callback, file)
	},
	// this should accept as many types as possible
	// unused!
	upload_image(thing, callback) {
		if (thing instanceof HTMLCanvasElement) {
			thing.toBlob((blob)=>{
				if (blob)
					this.upload_file(blob, callback)
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
	
	upload_file(file, params, callback) {
		let form = new FormData()
		form.append('file', file)
		
		this.request("File"+this.query_string(params), 'POST', (e, resp)=>{
			if (e)
				callback(e, resp)
			else {
				let l = [resp]
				Entity.process_list('file',l,{})
				callback(e, l[0])
			}
		}, form)
	},
	
	toggle_hiding(id, callback) {
		return this.get_me((me)=>{
			if (me) {
				let hiding = me.hidelist
				let hidden = arrayToggle(hiding, id)
				this.set_basic({hidelist:hiding}, (e)=>{
					if (e)
						callback(null)
					else
						callback(hidden)
				})
			} else
				callback(null)
		})
	},
	
	searchUsers(text, callback) {
		let like = text.replace(/%/g,"_") //the best we can do...
		let count = 20
		return this.read([
			['user', {limit: count, usernameLike: "%"+like+"%", sort: 'editDate', reverse: true}],
		], {}, (e, resp)=>{
			if (!e)
				callback(resp.user_map)
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
			['user~Usearch', {limit: count, skip: page, usernameLike: like+"%"}],
			['content', {limit: count, skip: page, nameLike: "%"+like+"%"}],
			['content', {limit: count, skip: page, keyword: like}],
			['user.1createUserId.2createUserId'],
		],{
			content: 'name,id,type,permissions,createUserId', //eh
		}, (e, resp)=>{
			if (!e)
				callback(resp.Usearch, resp.content)
			else
				callback(null)
		})
	},
	
	// might be worth speeding up in entity.js (100ms)
	get_recent_activity(callback, fail) {
		let day = 1000*60*60*24
		let start = new Date(Date.now() - day).toISOString()
		// "except no that won't work if site dies lol"
		return this.read([
			['activity', {createStart: start}],
			['comment~Mall', {reverse: true, limit: 1000}],
			['activity~Awatching', {contentLimit:{watches:true}}],
			['content.0contentId.1parentId.2contentId'],
			['comment', {limit: 50, reverse: true, createStart: start}],
			['user.0userId.1editUserId.2userId.4createUserId'],
		], {
			content: 'name,id,permissions,type',
			Mall: 'parentId,editUserId,editDate',
		}, (e,resp)=>{
			if (e)
				fail(e, resp)
			else
				callback(resp)
		})
	},
	
	setVote(id, state, callback) {
		this.request("Vote/"+id+"/"+(state||"delete"), 'POST', callback)
	},
	
	editPage(page, callback) {
		if (this.locked) {
			console.log("editing page:", page)
			callback(true, null)
			return
		}
		if (page.id)
			this.request("Content/"+page.id, 'PUT', callback, page)
		else
			this.request("Content", 'POST', callback, page)
	},
	
	get_older_comments(pid, firstId, count, callback, err) {
		let fi = {reverse: true, limit: count, parentIds: [pid]}
		if (firstId != null)
			fi.maxId = firstId // maxId is EXCLUSIVE
		return this.read([
			['comment', fi],
			['user.0createUserId.0editUserId'],
		], {}, (e, resp)=>{
			if (!e)
				callback(resp.comment)
			else
				callback(null)
		})
		// so messy, with the different types of error hiding and shit
	},
	
	get_newer_comments(pid, lastId, count, callback) {
		let fi = {limit: count, parentIds: [pid]}
		if (lastId != null)
			fi.minId = lastId
		return this.read([
			['comment', fi],
			['user.0createUserId.0editUserId'],
		], {}, (e, resp)=>{
			if (!e)
				callback(resp.comment)
			else
				callback(null)
		})
	},
	
	send_message(room, text, meta, callback) {
		this.request("Comment", 'POST', callback, {parentId: room, content: Entity.encode_comment(text, meta)})
	},
	
	edit_message(id, room, text, meta, callback) {
		this.request("Comment/"+id, 'PUT', callback, {parentId: room, content: Entity.encode_comment(text, meta)})
	},
	
	delete_message(id, callback) {
		this.request("Comment/"+id+"/delete", 'POST', callback)
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
