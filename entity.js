// todo:
// when replacing user ids with user objects,
// if the user doesn't exist, we should add a dummy object,
// so it's possible to at least determine the type of the missing data

// functions for processing recieved entities/
// DATA PROCESSOR

<!--/* trick indenter
var Entity = Object.create(null)
with (Entity) (function($) { "use strict"
Object.assign(Entity, { //*/

categoryMap: null,
gotNewCategory: false,

onCategoryUpdate: null,

CONTENT_TYPES: [
	'resource', 'chat', 'program', 'tutorial', 'documentation', 'userpage'
],

filterNickname: function(name) {
	return name.substr(0,50).replace(/\n/g, "  ")
},

process: function(resp) {
	// build user map first
	var users = {}
	for (var key in resp) {
		var type = keyType(key)
		if (type == 'user') {
			processList(type, resp[key], users)
			resp[key].forEach(function(user) {
				users[user.id] = user
			})
		}
	}
	if (resp.Ctree) {
		processList('category', resp.Ctree, users)
	}
	for (var key in resp) {
		var type = keyType(key)
		if (type != 'user' && key != 'Ctree')
			processList(type, resp[key], users)
	}
	resp.userMap = users
	
	if (gotNewCategory) {
		rebuildCategoryTree()
		$.setTimeout(function() {
			onCategoryUpdate && onCategoryUpdate(categoryMap)
		}, 0)
	}
},
keyType: function(key) {
	if (key.substr(0,2) == "CA")
		return "commentaggregate"
	if (key[0] == "C")
		return "category"
	if (key[0] == "P")
		return "content"
	if (key[0] == "U")
		return "user"
	if (key[0] == "A")
		return "activity"
	if (key[0] == "M")
		return "comment"
	return key
},
processList: function(type, data, users) {
	var proc = processItem[type]
	if (!proc) {
		console.warn('recvd unknown type', type, data)
		return // uh oh, unknown type
	}
	if (type == 'category')
		gotNewCategory = true
	data.forEach(function(item, i, data) {
		// this is done in-place
		data[i] = proc(item, users)
		data[i].Type = type
	})
},
get: function(map, type, id) {
	var n = map[id]
	if (n)
		return n
	return {Type:type, id:id, Fake:true}
},
processItem: {
	activity: function(data, users) {
		if (data.date)
			data.date = parseDate(data.date)
		if (data.type == 'user')
			data.content = get(users, 'user', data.contentId)
		if (data.userId)
			data.user = get(users, 'user', data.userId)
		return data
	},
	user: function(data, users) {
		if (data.createDate)
			data.createDate = parseDate(data.createDate)
		data.name = data.name || data.username
		return data
	},
	category: function(data, users) {
		var cat = categoryMap[data.id]
		if (!cat) {
			categoryMap[data.id] = cat = data
		} else {
			Object.assign(cat, data)
			data = cat
		}
		data = processItem.editable(data, users)
		return data
	},
	content: function(data, users) {
		data = processItem.editable(data, users)
		if (data.parentId != undefined)
			data.parent = categoryMap[data.parentId]
		data.users = users //hack for permissions users
		return data
	},
	comment: function(data, users) {
		data = processItem.editable(data, users)
		if (data.content) {
			var m = decodeComment(data.content)
			data.content = m.t
			delete m.t //IMPORTANT
			data.meta = m
			// avatar override
			var av = +data.meta.a
			if (av)
				data.createUser = Object.create(data.createUser, {
					avatar: {value: av},
					bigAvatar: {value: +data.meta.big}
				})
			// nicknames
			var nick = undefined
			var bridge = undefined
			if (typeof data.meta.b == 'string') {
				nick = data.meta.b
				bridge = nick
				if (
					data.meta.m == '12y' &&
					data.content.substr(0, nick.length+3) == "<"+nick+"> "
				) {
					data.content = data.content.substring(nick.length+3, data.content.length)
				}
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
						nickname: {value: filterNickname(nick)},
						realname: {value: data.createUser.name},
					})
				else
					data.createUser = Object.create(data.createUser, {
						nickname: {value: filterNickname(nick)},
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
	file: function(data, users) {
		data = processItem.editable(data, users)
		return data
	},
	editable: function(data, users) {
		data.editUser = get(users, 'user', data.editUserId)
		data.createUser = get(users, 'user', data.createUserId)
		data.editDate = parseDate(data.editDate)
		data.createDate = parseDate(data.createDate)
		return data
	},
	watch: function(data) {
		return data //TODO
	},
	activityaggregate: function(data, users) {
		data.users = data.userIds.map(function(id) {
			return get(users, 'user', id)
		})
		return data
	},
	commentaggregate: function(data, users) {
		// need to filter out uid 0 (I think this comes from deleted comments)
		data.users = data.userIds.filter(function(x){return x}).map(function(id) {
			return get(users, 'user', id)
		})
		if (data.firstDate)
			data.firstDate = parseDate(data.firstDate)
		if (data.lastDate)
			data.lastDate = parseDate(data.lastDate)
		return data
	},
},

makePageMap: function(page) {
	var pageMap = {}
	page && page.forEach(function(p) {
		pageMap[p.id] = p
	})
	return pageMap
},

rebuildCategoryTree: function() {
	gotNewCategory = false
	for (var id in categoryMap)
		categoryMap[id].children = []
	// todo: make sure root category doesn't have parent
	for (var id in categoryMap) {
		var cat = categoryMap[id]
		var parent = categoryMap[cat.parentId] || categoryMap[0]
		if (cat.id != 0) {
			parent.children.push(cat)
			cat.parent = parent
		}
	}
},
// as far as I know, the o3DS doesn't support parsing ISO 8601 timestamps
parseDate: function(str) {
	if (!str)
		return new $.Date(0)
	if (typeof str != 'string')
		console.log("got weird date:", str)
	var data = str.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/)
	if (!data)
		return new $.Date(0)
	var sec = $.Math.floor(+data[6])
	var ms = +data[6] - sec
	return new $.Date(Date.UTC(+data[1], +data[2]-1, +data[3], +data[4], +data[5], sec, ms))
},
decodeComment: function(content) {
	var newline = content.indexOf("\n")
	try {
		// try to parse the first line as JSON
		var data = JSON.parse(newline>=0 ? content.substr(0, newline) : content)
	} finally {
		if (data && data.constructor == Object) { // new or legacy format
			if (newline >= 0)
				data.t = content.substr(newline+1) // new format
		} else // raw
			data = {t: String(content)}
		return data
	}
},
encodeComment: function(text, metadata) {
	return JSON.stringify(metadata || {})+"\n"+text
},

<!--/* 
}) //*/

categoryMap = {0: {
	name:"[root]",
	id:0,
	Type:'category',
	description:"",
	values:{}
}}

<!--/*
}(window)) //*/
