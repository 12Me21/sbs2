'use strict'
const TYPES = {}

// permissions class? idk

let Entity

class Author {
	constructor(message, user) {
		this.username = user.username
		// normal avatar
		let av = message.values.a
		if (av && ('string'==typeof av || 'number'==typeof av))
			this.avatar = av
		else
			this.avatar = user.avatar
		// bigavatar
		let ab = message.values.big
		if (ab && ('string'==typeof ab || 'number'==typeof ab))
			this.bigAvatar = ab
		// == names ==
		this.username = user.username
		let nick = null
		// message from discord bridge
		//let bridge = 'string'==typeof message.values.b
		//if (bridge)
		//	nick = message.values.b
		let bridge = user.id == 5410
		// regular nickname
		if ('string'==typeof message.values.n)
			nick = message.values.n
		
		if (nick != null) {
			nick = Entity.filter_nickname(nick)
			if (bridge)
				this.username = nick
			this.nickname = nick
			this.realname = user.username
		}
	}
}
Object.assign(Author.prototype, {
	avatar: "0",
	bigAvatar: null,
	username: "missingno.",
	realname: null,
	nickname: null,
	//			content_name: "",
})

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
		proto.Author = {
			value: Object.freeze(Object.create(Author.prototype)),
			writable: true,
		}
	}
	for (let field_name in field_datas) {
		let field_data = field_datas[field_name]
		let field_default = field_defaults[field_name]
		proto[field_name] = {value: field_default, enumerable: true, writable: true}
		if (field_data.type=='datetime')
			proto[field_name+"2"] = {get() {
				let d = this[field_name]
				return d ? new Date(d) : null
			}}
	}
	proto = Object.create(STRICT, proto)
	let cons = (o)=>{
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
Entity = singleton({
	
	// official page types
	CONTENT_TYPES: [
		'resource', 'chat', 'program', 'tutorial', 'documentation',
	],
	has_perm(perms, uid, perm) {
		return perms && perms[uid] && perms[uid].includes(perm)
	},
	
	comment_merge_hash(comment) {
		let user = comment.Author
		return `${comment.contentId},${comment.createUserId},${user.avatar},${user.bigAvatar||""},${user.username} ${user.nickname || ""}`
	},
	
	filter_nickname(name) {
		return String(name).substr(0, 50).replace(/\n/g, "  ")
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
		for (let name in listmapmap)
			this.do_listmap(listmapmap[name])
		return listmapmap
	},
	
	do_listmap(listmap) {
		for (let name in listmap)
			this.do_list(listmap[name], name)
		if (listmap.message && listmap.user)
			this.link_comments(listmap)
		return listmap
	},
	
	do_list(list, name) {
		// todo: better system for mapping types
		let type = list.Type || this.key_type(name)
		let cons = TYPES[type] || (x=>x) // fallback (bad)
		for (let entity of list)
			list[~entity.id] = cons(entity)
		// using ~ on the id will map 0 → -1, 1 → -2, 2 → -3 etc.
		// this avoids nonnegative integer keys,
		// since the order of those isn't preserved,
		return list
	},
	
	// link user data with comments
	link_comments({message, user}) {
		for (let m of message) {
			let u = user[~m.createUserId]
			if (!u)
				continue
			m.Author = new Author(m, u)
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
	
	is_new_comment(c) {
		return !c.deleted && !c.edited
	},
	
	ascending(list, field='id') {
		if (list.length>1 && list[0][field] > list[1][field])
			list.reverse()
	},
})
