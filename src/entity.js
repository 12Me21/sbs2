const TYPES = {}

for (let type_name in ABOUT.details.types) {
	let field_datas = ABOUT.details.types[type_name]
	let field_defaults = ABOUT.details.objects[type_name]
	let writables = {}
	let proto = {
		// common methods
		toJSON: {}, // JSON.stringify() etc.
		then: {}, // Promise, await
		// conversions
		[Symbol.toPrimitive]: {value: NO_CONVERT},
		[Symbol.toStringTag]: {value: "Entity:"+type_name},
		/*[Symbol.toBlob]:*/
		Blob: {value() {
			return new Blob([JSON.stringify(this)], {type:"application/json;charset=UTF-8"})
		}},
		// type info
		Type: {value: type_name},
		Fields: {value: field_datas},
	}
	if (type_name == 'message') {
		proto.Author = {value: Object.freeze({
			avatar: "0",
			bigAvatar: null,
			realname: "",
			nickname: "",
			username: "",
//			content_name: "",
		})}
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
	/*if (type_name == 'message')
		cons = (o)=>{
			if (o.editDate == o.createDate) // correction for old comments
				o.editDate = null
			Object.setPrototypeOf(o, proto)
			return o
		}
	else*/
	cons = (o)=>{
		Object.setPrototypeOf(o, proto)
		return o
	}
	//cons.Fields = field_datas
	TYPES[type_name] = cons
}

ABOUT = null

function map_user(obj, prop, users) {
	let user = users[obj[prop+"Id"]]
	obj[prop] = user || null
}
function map_date(obj, prop) {
	if (obj[prop])
		obj[prop] = new Date(obj[prop])
}

//class Emap

// functions for processing recieved entities/
// DATA PROCESSOR
let Entity = (()=>{"use strict"; return singleton({
	
/*	onCategoryUpdate(cats) {
		Sidebar.redraw_category_tree(cats)
	},
	
	category_map: {0: {
		name: "[root]",
		id: 0,
		Type: 'category',
		description: "",
		values: {}
	}},
	got_new_category: false,*/
	
	// official page types
	CONTENT_TYPES: [
		'resource', 'chat', 'program', 'tutorial', 'documentation', 'userpage'
	],
	// I don't like the way the iterator works here...
/*	safe_map(map, fake) {
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
	
,*/
	has_perm(perms, uid, perm) {
		return perms && perms[uid] && perms[uid].includes(perm)
	},
	
	comment_merge_hash(comment) {
		let user = comment.Author
		return `${comment.contentId},${comment.createUserId},${user.avatar},${user.bigAvatar||""},${user.username} ${user.nickname || ""}`
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
	
	do_listmapmap(listmapmap) {
		Object.for(listmapmap, (listmap) => this.do_listmap(listmap))
		return listmapmap
	},
	
	do_listmap(listmap) {
		Object.for(listmap, (list, name) => this.do_list(list, name))
		if (listmap.message && listmap.user)
			this.link_comments(listmap)
		return listmap
	},
	
	do_list(list, name) {
		let type = this.key_type(name)
		let cons = TYPES[type]
		for (let entity of list)
			list[~entity.id] = cons(entity)
		// using ~ on the id will map 0 → -1, 1 → -2, 2 → -3 etc.
		// this avoids nonnegative integer keys,
		// since the order of those isn't preserved,
		return list
	},
	
	// link user data with comments
	link_comments({message:messages, user:users}) {
		for (let message of messages) {
			let user = users[~message.createUserId]
			if (!user)
				continue
			// maybe just have a setter so you can do message.Author = user and then it assigns the fields...
			let author = {
				username: user.username,
			}
			// normal avatar
			let av = message.values.a
			if (av && ('string'==typeof av || 'number'==typeof av))
				author.avatar = av
			else
				author.avatar = user.avatar
			// bigavatar
			let ab = message.values.big
			if (ab && ('string'==typeof ab || 'number'==typeof ab))
				author.bigAvatar = ab
			// == names ==
			author.username = user.username
			let nick = null
			// message from discord bridge
			let bridge = 'string'==typeof message.values.b
			if (bridge)
				nick = message.values.b
			// regular nickname
			if ('string'==typeof message.values.n)
				nick = message.values.n
			
			if (nick != null) {
				nick = this.filter_nickname(nick)
				if (bridge)
					author.username = nick
				author.nickname = nick
				author.realname = user.username
			}
			
			Object.defineProperty(message, 'Author', {value:author, writable:true});
		}
	},
	
	key_type(key) {
		return {
			A: 'activity',
			U: 'user',
			C: 'content',
			M: 'message',
			G: 'message_aggregate', // ran out of letters
		}[key[0]] || key
	},
	
	/*rebuildCategoryTree() {
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
	},*/
	// return: [text, metadata]
	
	is_new_comment(c) {
		return !c.deleted && !c.edited
	},
	
	ascending(list, field='id') {
		if (list.length>1 && list[0][field] > list[1][field])
			list.reverse()
	}
})})()
