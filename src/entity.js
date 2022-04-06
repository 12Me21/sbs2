// functions for processing recieved entities/
// DATA PROCESSOR
let Entity = (()=>{"use strict"; return singleton({
	
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
	// I don't like the way the iterator works here...
	safe_map(map, fake) {
		// `fake` accessed as nonlocal
		return new Proxy(map, {
			get(map, id) {
				if (id == Symbol.iterator) {
					let e = Object.entries(map)
					return e[Symbol.iterator].bind(e)
				}
				return map[id] || fake(+id, map)
			},
			has(map, id) {
				return map[id]!=undefined
			},
		})
	},
	
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
		return
		// build user map first
		let map = {}
		let users = this.safe_map(map, (id)=>({
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
		return resp // for convenienece
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
	process_item(type, data) {
		let l = [data]
		Entity.process_list(type, l, {})
		return l[0]
	},
	process_list(type, data, users) {
		let proc = this.process_type[type]
		if (!proc) {
			console.warn('recvd unknown type', type, data)
			return // uh oh, unknown type
		}
		proc = proc.bind(this) //oops, we have to bind `this` here. maybe time to rethink the use of `this`...
		if (type == 'category')
			this.got_new_category = true
		data.forEach((item, i, data)=>{
			// this is done in-place
			data[i] = proc(item, users)
			data[i].Type = type
		})
	},
	// editUserId -> editUser
	// createUserId -> createUser
	// editDate
	// createDate
	process_editable(data, users) {
		if (data.editUserId) // checking both null and 0
			data.editUser = users[data.editUserId]
		if (data.createUserId)
			data.createUser = users[data.createUserId]
		if (data.editDate) // date will always be non-null in the database but we might filter it out in the response
			data.editDate = this.parse_date(data.editDate)
		if (data.createDate)
			data.createDate = this.parse_date(data.createDate)
	},
	process_comment_user_meta(data) {
		let override = {}
		// avatar override
		if (+data.meta.a)
			override.avatar = {value: +data.meta.a}
		if (+data.meta.big)
			override.bigAvatar = {value: +data.meta.big}
		// nicknames
		let nick = null
		let bridge = null
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
			override.nickname = {value: this.filter_nickname(nick)}
			override.realname = {value: data.createUser.name}
			// if the bridge name is set, we set the actual .name property to that, so it will render as the true name in places where nicknames aren't handled (i.e. in the sidebar)
			// and it's kinda dangerous that .b property is trusted so much..
			if (bridge != undefined)
				override.name = {value: bridge}
		}
		// todo: we should render the nickname in other places too (add this to the title() etc. functions.
		// and then put like, some icon or whatever to show that they're nicked, I guess.
		
		// won't this fail on comments without a createuser for whatever reason??
		if (Object.first_key(override) != undefined)
			data.createUser = Object.create(data.createUser, override)
	},
	process_type: {
		// date
		// contentId -> content
		// userId -> user
		activity(data, users) {
			if (data.date)
				data.date = this.parse_date(data.date)
			if (data.type == 'user')
				data.content = users[data.contentId]
			if (data.userId)
				data.user = users[data.userId]
			return data
		},
		// createDate
		// username -> name
		user(data, users) {
			if (data.createDate)
				data.createDate = this.parse_date(data.createDate)
			// store user's name in .name instead of .username to be consistent with other entity types
			data.name = data.name || data.username
			return data
		},
		// update category map?
		category(data, users) {
			let cat = this.category_map[data.id]
			if (!cat) {
				this.category_map[data.id] = cat = data
			} else {
				Object.assign(cat, data)
				data = cat
			}
			this.process_editable(data, users)
			return data
		},
		// parentId -> parent
		// ?? -> users
		content(data, users) {
			this.process_editable(data, users)
			if (data.parentId != null)
				data.parent = this.category_map[data.parentId]
			return data
		},
		// content
		// content -> meta, nickname, realname, name, avatar, bigAvatar
		comment(data, users) {
			this.process_editable(data, users)
			if (data.content) {
				;[data.content, data.meta] = this.decode_comment(data.content)
				this.process_comment_user_meta(data)
			} else { // deleted comment usually
				data.meta = {}
			}
			return data
		},
		file(data, users) {
			this.process_editable(data, users)
			return data
		},
		watch(data) {
			return data //TODO
		},
		// userIds -> users
		activityaggregate(data, users) {
			data.users = data.userIds /*.filter(id=>id)*/ .map(id=>users[id])
			return data
		},
		// userIds -> users
		// firstDate
		// lastDate
		commentaggregate(data, users) {
			// need to filter out uid 0 (I think this comes from deleted comments)
			data.users = data.userIds.filter(id=>id).map(id=>users[id])
			if (data.firstDate)
				data.firstDate = this.parse_date(data.firstDate)
			if (data.lastDate)
				data.lastDate = this.parse_date(data.lastDate)
			return data
		},
		systemaggregate(data, users) {
			return data
			// rip recv'd unknown :(
		},
	},
	
	page_map(pages) {
		let map = {}
		pages && pages.forEach(p => map[p.id] = p)
		return this.safe_map(map, (id)=>({
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
	parse_date(str) {
		return new Date(str)
	},
	// return: [text, metadata]
	decode_comment(content) {
		let newline = content.indexOf("\n")
		try {
			// try to parse the first line as JSON
			let data = JSON.parse(newline>=0 ? content.substr(0, newline) : content)
			// if it's a valid json object, it could be new or legacy format
			if (Object.is_plain(data)) { // (see fill.js)
				let t = data.t
				delete data.t // important!
				// new format: <json><newline><text>
				if (newline>=0)
					return [content.substr(newline+1), data]
				// legacy format: <json> (text in "t" field)
				if (typeof t == 'string')
					return [t, data]
			}
		} catch(e) {}
		// if we can't detect the format, or something goes wrong,
		// just return the raw content and no metadata
		return [content, {}]
	},
	encode_comment(text, metadata) {
		return JSON.stringify(metadata || {})+"\n"+text
	},
	
	is_new_comment(c) {
		return !c.deleted && (+c.editDate == +c.createDate)
	},
})})()
