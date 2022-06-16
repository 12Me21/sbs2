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

// TODO: improve class structure:

// TYPES[thing]:
// .init(obj) -> instance
// .new() -> create new, with default values
// .fields[name] -> info about field, incl default value
// .prototype -> used for the prototype of instances
// some way of extracting/setting all writable fields? (for the editor)

// so like, you'd do, for editing:
// - download data
// - call TYPES[type].init(obj)
// - get a list of writable fields and let the user edit
// - put the new values back into the original object
// - 

function BaseEntity() {
}
BaseEntity.prototype = Object.create(STRICT, {
	toJSON: {}, // JSON.stringify() etc.
	then: {}, // Promise, await
	// conversions
	[Symbol.toPrimitive]: {value: NO_CONVERT},
	Blob: {
		value() {
			return new Blob([JSON.stringify(this)], {type:"application/json;charset=UTF-8"})
		}
	},
	[Symbol.toStringTag]: {
		get() { return "qcs:"+this.Type }
	},
})

for (let name in ABOUT.details.types) {
	let proto_desc = {
		constructor: null,
		Type: {value: name},
	}
	if (name == 'message') {
		proto_desc.Author = {
			value: Object.freeze(Object.create(Author.prototype)),
			writable: true,
		}
	}
	let fields = ABOUT.details.types[name]
	let defaults = ABOUT.details.objects[name]
	for (let key in fields) {
		let field = fields[key]
		proto_desc[key] = {
			enumerable: true, writable: true,
			value: Object.freeze(defaults[key]),
		}
		if (field.type=='datetime')
			proto_desc[key+"2"] = {get() {
				let d = this[key]
				return d ? new Date(d) : null
			}}
	}
	let proto
	let cons = (o)=>{
		return Object.setPrototypeOf(o, proto)
	}
	//Object.setPrototypeOf(cons, BaseEntity)
	proto_desc.constructor = {value: cons}
	proto = Object.create(BaseEntity.prototype, proto_desc)
	Object.defineProperties(cons, {
		name: {value: "qcs:"+name},
		prototype: {value: proto},
	})
	TYPES[name] = cons
}
// change all the maps to be bidirectional
// ex: {'0':'none', '1':'page', none:0, page:1}
for (let enm in ABOUT.details.codes) {
	let map = ABOUT.details.codes[enm]
	for (let code in map) {
		map[map[code]] = code
		map.MAX = code
	}
}

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
		if (list.length>1 && list[0][field] > list[1][field]) {
			print("warning: events reversed?")
			list.reverse()
		}
	},
})
