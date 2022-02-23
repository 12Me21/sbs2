// todo:
// when replacing user ids with user objects,
// if the user doesn't exist, we should add a dummy object,
// so it's possible to at least determine the type of the missing data

// functions for processing recieved entities/
// DATA PROCESSOR

function entity_map(map, fake) {
	return new Proxy({map, fake}, {
		get({map, fake}, id) {
			return map[id] || fake(id, map)
		}
	})
}

let Entity = {
	onCategoryUpdate(cats) {
		Sidebar.redraw_category_tree(cats)
	},
	
	category_map: {0: {
		name: "[root]",
		id: 0,
		Type: 'category',
		description: "",
		values: {}
	}},
	got_new_category: false,
	
	// official page types
	CONTENT_TYPES: [
		'resource', 'chat', 'program', 'tutorial', 'documentation', 'userpage'
	],
	
	has_perm(perms, uid, perm) {
		return perms && perms[uid] && perms[uid].includes(perm)
	},
	
	comment_merge_hash(comment) {
		let user = comment.createUser || {}
		return `${comment.parentId},${comment.createUserId},${user.avatar},${user.bigAvatar||""},${user.name} ${user.nickname || ""}`
	},
	
	filter_nickname(name) {
		return String(name).substr(0,50).replace(/\n/g, "  ")
	},
	
	// should this return null?
	// I'm not sure how this should work exactly
	// maybe just split on non-digits really
	parse_numbers(x) {
		if (x==null || x=="")
			return null
		return x.split(/[, ]+/).filter(x=>/^\d+$/.test(x)).map(x=>+x)
	},
	
	process(resp) {
		//let x = performance.now()
		// build user map first
		let map = {}
		let users = entity_map(map, (id)=>({
			Type: 'user',
			name: `{user: ${id}}`,
			id: id,
			fake: true,
		}))
		
		Object.for(resp, (data, key)=>{
			let type = this.key_type(key)
			if (type == 'user') {
				this.process_list(type, data, users)
				for (let user of data)
					map[user.id] = user
			}
		})
		
		if (resp.Ctree)
			this.process_list('category', resp.Ctree, users)
		
		Object.for(resp, (data, key)=>{
			let type = this.key_type(key)
			if (type!='user' && key!='Ctree')
				this.process_list(type, data, users)
		})
		resp.user_map = users
		
		if (this.got_new_category) {
			this.rebuildCategoryTree()
			window.setTimeout(()=>{
				this.onCategoryUpdate && this.onCategoryUpdate(this.category_map)
			}, 0)
		}
		//console.log('process took:', performance.now()-x, resp)
	},
	key_type(key) {
		return {
			A: 'activity',
			C: 'category',
			U: 'user',
			P: 'content', // "page"
			M: 'comment', // "message"
			G: 'commentaggregate', // ran out of letters
		}[key[0]] || key
	},
	process_list(type, data, users) {
		let proc = this.process_type[type]
		if (!proc) {
			console.warn('recvd unknown type', type, data)
			return // uh oh, unknown type
		}
		if (type == 'category')
			this.got_new_category = true
		data.forEach((item, i, data)=>{
			// this is done in-place
			data[i] = proc.call(this, item, users) //oops, we have to bind `this` here. maybe time to rethink the use of `this`...
			data[i].Type = type
		})
	},
	process_editable(data, users) {
		data.editUser = users[data.editUserId]
		data.createUser = users[data.createUserId]
		if (data.editDate) // date will always be non-null in the database but we might filter it out in the response
			data.editDate = this.parse_date(data.editDate)
		if (data.createDate)
			data.createDate = this.parse_date(data.createDate)
		return data
	},
	process_type: {
		activity(data, users) {
			if (data.date)
				data.date = this.parse_date(data.date)
			if (data.type == 'user')
				data.content = users[data.contentId]
			if (data.userId)
				data.user = users[data.userId]
			return data
		},
		user(data, users) {
			if (data.createDate)
				data.createDate = this.parse_date(data.createDate)
			// store user's name in .name instead of .username to be consistent with other entity types
			data.name = data.name || data.username
			return data
		},
		category(data, users) {
			let cat = this.category_map[data.id]
			if (!cat) {
				this.category_map[data.id] = cat = data
			} else {
				Object.assign(cat, data)
				data = cat
			}
			data = this.process_editable(data, users)
			return data
		},
		content(data, users) {
			data = this.process_editable(data, users)
			if (data.parentId != null)
				data.parent = this.category_map[data.parentId]
			data.users = users //hack for permissions users. TODO: what?
			return data
		},
		comment(data, users) {
			data = this.process_editable(data, users)
			if (data.content) {
				let m = this.decode_comment(data.content)
				data.content = m.t
				delete m.t //IMPORTANT
				data.meta = m
				// avatar override
				let av = +data.meta.a
				if (av)
					data.createUser = Object.create(data.createUser, {
						avatar: {value: av},
						bigAvatar: {value: +data.meta.big}
					})
				// nicknames
				let nick = undefined
				let bridge = undefined
				if (typeof data.meta.b == 'string') {
					nick = data.meta.b
					bridge = nick
					// strip bridge nickname from old discord messages
					if (data.meta.m=='12y' && data.content.substr(0, nick.length+3) == "<"+nick+"> ")
						data.content = data.content.substring(nick.length+3, data.content.length)
				}
				if (typeof data.meta.n == 'string')
					nick = data.meta.n
				if (nick != undefined) {
					// if the bridge name is set, we set the actual .name property to that, so it will render as the true name in places where nicknames aren't handled (i.e. in the sidebar)
					// todo: clean this up..
					// and it's kinda dangerous that .b property is trusted so much..
					if (bridge != undefined)
						data.createUser = Object.create(data.createUser, {
							name: {value: bridge},
							nickname: {value: this.filter_nickname(nick)},
							realname: {value: data.createUser.name},
						})
					else
						data.createUser = Object.create(data.createUser, {
							nickname: {value: this.filter_nickname(nick)},
							realname: {value: data.createUser.name},
						})
				}
				// todo: we should render the nickname in other places too (add this to the title() etc. functions.
				// and then put like, some icon or whatever to show that they're nicked, I guess.
				
			} else { // deleted comment usually
				data.meta = {}
			}
			return data
		},
		file(data, users) {
			data = this.process_editable(data, users)
			return data
		},
		watch(data) {
			return data //TODO
		},
		activityaggregate(data, users) {
			data.users = data.userIds.map((id)=>users[id])
			return data
		},
		commentaggregate(data, users) {
			// need to filter out uid 0 (I think this comes from deleted comments)
			data.users = data.userIds.filter(x=>x!=0).map((id)=>users[id])
			if (data.firstDate)
				data.firstDate = this.parse_date(data.firstDate)
			if (data.lastDate)
				data.lastDate = this.parse_date(data.lastDate)
			return data
		},
	},
	
	page_map(pages) {
		let map = {}
		pages && pages.forEach(p => map[p.id] = p)
		return entity_map(map, (id)=>({
			Type: 'content',
			name: `{content: ${id}}`,
			id: id,
			fake: true,
		}))
	},
	
	rebuildCategoryTree() {
		this.got_new_category = false
		Object.for(this.category_map, (cat)=> cat.children = [])
		// todo: make sure root category doesn't have parent
		Object.for(this.category_map, (cat)=>{
			let parent = this.category_map[cat.parentId] || this.category_map[0]
			if (cat.id != 0) {
				parent.children.push(cat)
				cat.parent = parent
			}
		})
	},
	// parsing the ISO 8601 timestamps used by sbs
	// new Date() /can/ do this, but just in case...
	parse_date(str) {
		if (str == null)
			return null
		if (typeof str != 'string') {
			console.log("got weird date:", str)
			return new Date(NaN)
		}
		let data = str.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/)
		if (!data) {
			console.error("couldn't parse date:", str)
			return new Date(NaN)
		}
		let sec = Math.floor(+data[6])
		let ms = +data[6] - sec
		return new Date(Date.UTC(+data[1], +data[2]-1, +data[3], +data[4], +data[5], sec, ms)) // yes you NEED to call Date.UTC, otherwise the timezone is wrong!
	},
	decode_comment(content) {
		let newline = content.indexOf("\n")
		let data
		try {
			// try to parse the first line as JSON
			data = JSON.parse(newline>=0 ? content.substr(0, newline) : content)
		} finally {
			if (data && Object.getPrototypeOf(data)==Object.prototype) { // new or legacy format
				if (newline>=0)
					data.t = content.substr(newline+1) // new format
				else
					data.t = String(data.t)
			} else // raw
				data = {t: content}
			return data
		}
	},
	encode_comment(text, metadata) {
		return JSON.stringify(metadata || {})+"\n"+text
	},
}
