const TYPES = {}

for (let type_name in ABOUT.details.types) {
	let field_datas = ABOUT.details.types[type_name]
	let field_defaults = ABOUT.details.objects[type_name]
	let writables = {}
	let proto = {
		toJSON: {}, //idea: keep track of whether an object was requested with fields=*, and prevent posting it otherwise
		then: {},
		Type: {value: type_name},
		Fields: {value: field_datas},
		// temp: 
		name: {get() { return this.username }},
		bigAvatar: {value: null},
		nickname: {value: null},
		realname: {value: null},
	}
	for (let field_name in field_datas) {
		let field_data = field_datas[field_name]
		let field_default = field_defaults[field_name]
		proto[field_name] = {value: field_default, enumerable: true}
		if (field_data.type=='datetime')
			proto[field_name+"2"] = {get(){
				let d = this[field_name]
				return d ? new Date(d) : null
			}}
	}
	proto = Object.create(STRICT, proto)
	let cons
	if (type_name=='message')
		cons = (o, u)=>{
			// TODO: this is kinda a memory leak, 
			// we really only need like, avatar and etc.
			map_user(o, 'createUser', u)
			map_user(o, 'editUser', u)
			Object.setPrototypeOf(o, proto)
			return o
		}
	else 
		cons = (o, u)=>{
			/*for (let field_name in o) {
			  let field_data = field_datas[field_name]
			  let writable = field_data.writableOnInsert || field_data.writableOnUpdate
			  Object.defineProperty(o, field_name, {
			  value: o[field_name], 
			  })
			  }*/
			
			Object.setPrototypeOf(o, proto)
			return o
			//Object.defineProperties(this, Object.getOwnPropertyDescriptors(o))
		}
	TYPES[type_name] = cons
}

function map_user(obj, prop, users) {
	let user = users[obj[prop+"Id"]]
	obj[prop] = user || null
}
function map_date(obj, prop) {
	if (obj[prop])
		obj[prop] = new Date(obj[prop])
}

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
		return `${comment.contentId},${comment.createUserId},${user.avatar},${user.bigAvatar||""},${user.name} ${user.nickname || ""}`
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
	
	process(data=~E) {
		// build user map first
		let user_map = {}
		
		if (data.user)
			for (let user of data.user)
				user_map[user.id] = user
		
		Object.for(data, (list, name)=>{
			let type = this.key_type(name)
			this.process_list(type, list, user_map)
		})
		
		/*if (resp.Ctree)
			this.process_list('category', resp.Ctree, users)*/
		
		data.user_map = user_map
		
		/*if (this.got_new_category) {
			this.rebuildCategoryTree()
			window.setTimeout(()=>{
				this.onCategoryUpdate && this.onCategoryUpdate(this.category_map)
			}, 0)
		}*/
		return data // for convenienece
	},
	key_type(key) {
		return {
			A: 'activity',
			U: 'user',
			C: 'content',
			M: 'message',
			G: 'commentaggregate', // ran out of letters
		}[key[0]] || key
	},
	process_item(type, item, users) {
		if (TYPES[type])
			TYPES[type](item, users)
		return item
	},
	process_list(type, list, users) {
		if (TYPES[type])
			for (let item of list) {
				list["-"+item.id] = TYPES[type](item, users)
				// we use a "-" prefix for the map keys, since
				// we want to preserve the order
				// so the keys can't be nonnegative integers
			}
	},
	// editUserId -> editUser
	// createUserId -> createUser
	// editDate
	// createDate
	// TODO: instead of this silly user modifying thing, just render the damn message directly, based on its own data
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
			let parent = this.category_map[cat.contentId] || this.category_map[0]
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
