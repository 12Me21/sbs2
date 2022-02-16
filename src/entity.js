// todo:
// when replacing user ids with user objects,
// if the user doesn't exist, we should add a dummy object,
// so it's possible to at least determine the type of the missing data

// functions for processing recieved entities/
// DATA PROCESSOR

let Entity = {
	categoryMap: {0: {
		name: "[root]",
		id: 0,
		Type: 'category',
		description: "",
		values: {}
	}},
	gotNewCategory: false,
	
	onCategoryUpdate: null,
	// official page types
	CONTENT_TYPES: [
		'resource', 'chat', 'program', 'tutorial', 'documentation', 'userpage'
	],
	
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
		// build user map first
		let users = {}
		Object.for(resp, (data, key)=>{
			let type = this.key_type(key)
			if (type == 'user') {
				this.processList(type, data, users)
				data.forEach((user) => users[user.id] = user )
			}
		})
		
		if (resp.Ctree)
			this.processList('category', resp.Ctree, users)
		
		Object.for(resp, (data, key)=>{
			let type = this.key_type(key)
			if (type!='user' && key!='Ctree')
				this.processList(type, data, users)
		})
		resp.userMap = users
		
		if (this.gotNewCategory) {
			this.rebuildCategoryTree()
			window.setTimeout(()=>{
				this.onCategoryUpdate && this.onCategoryUpdate(this.categoryMap)
			}, 0)
		}
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
	processList(type, data, users) {
		let proc = this.process_type[type]
		if (!proc) {
			console.warn('recvd unknown type', type, data)
			return // uh oh, unknown type
		}
		if (type == 'category')
			this.gotNewCategory = true
		data.forEach((item, i, data)=>{
			// this is done in-place
			data[i] = proc.call(this, item, users) //oops, we have to bind `this` here. maybe time to rethink the use of `this`...
			data[i].Type = type
		})
	},
	// returns a dummy object if not found
	// todo: maybe create a special Map type
	// which stores its Type and has this as a METHOD
	get(map, type, id) {
		return map[id] || {Type:type, id:id, Fake:true}
	},
	process_editable(data, users) {
		data.editUser = this.get(users, 'user', data.editUserId)
		data.createUser = this.get(users, 'user', data.createUserId)
		if (data.editDate)
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
				data.content = this.get(users, 'user', data.contentId)
			if (data.userId)
				data.user = this.get(users, 'user', data.userId)
			return data
		},
		user(data, users) {
			if (data.createDate)
				data.createDate = this.parse_date(data.createDate)
			data.name = data.name || data.username
			return data
		},
		category(data, users) {
			let cat = this.categoryMap[data.id]
			if (!cat) {
				this.categoryMap[data.id] = cat = data
			} else {
				Object.assign(cat, data)
				data = cat
			}
			data = this.process_editable(data, users)
			return data
		},
		content(data, users) {
			data = this.process_editable(data, users)
			if (data.parentId != undefined)
				data.parent = this.categoryMap[data.parentId]
			data.users = users //hack for permissions users
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
			data.users = data.userIds.map((id)=>{
				return this.get(users, 'user', id)
			})
			return data
		},
		commentaggregate(data, users) {
			// need to filter out uid 0 (I think this comes from deleted comments)
			data.users = data.userIds.filter(x=>x!=0).map((id) => this.get(users, 'user', id))
			if (data.firstDate)
				data.firstDate = this.parse_date(data.firstDate)
			if (data.lastDate)
				data.lastDate = this.parse_date(data.lastDate)
			return data
		},
	},
	
	makePageMap(page) {
		let pageMap = {}
		page && page.forEach((p)=> pageMap[p.id] = p )
		return pageMap
	},
	
	rebuildCategoryTree() {
		this.gotNewCategory = false
		Object.for(this.categoryMap, (cat)=> cat.children = [])
		// todo: make sure root category doesn't have parent
		Object.for(this.categoryMap, (cat)=>{
			let parent = this.categoryMap[cat.parentId] || this.categoryMap[0]
			if (cat.id != 0) {
				parent.children.push(cat)
				cat.parent = parent
			}
		})
	},
	// parsing the ISO 8601 timestamps used by sbs
	// new Date() /can/ do this, but just in case...
	parse_date(str) {
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
