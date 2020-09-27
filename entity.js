// functions for processing recieved entities/
// DATA PROCESSOR
//call it process or format or something
<!--/* trick indenter
var Entity = Object.create(null)
with (Entity) (function($) { "use strict"
Object.assign(Entity, { //*/

categoryMap: null,
gotNewCategory: false,

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
	if (gotNewCategory)
		rebuildCategoryTree()
	resp.userMap = users
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
processItem: {
	activity: function(data, users) {
		if (data.date)
			data.date = parseDate(data.date)
		if (data.type == 'user')
			data.content = users[data.contentId]
		if (data.userId)
			data.user = users[data.userId]
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
		return data
	},
	comment: function(data, users) {
		data = processItem.editable(data, users)
		if (data.content) {
			var m = decodeComment(data.content)
			data.content = m.t
			data.meta = m
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
		if (data.editUserId)
			data.editUser = users[data.editUserId]
		if (data.createUserId)
			data.createUser = users[data.createUserId]
		if (data.editDate)
			data.editDate = parseDate(data.editDate)
		if (data.createDate)
			data.createDate = parseDate(data.createDate)
		return data
	},
	watch: function(data) {
		return data //TODO
	},
	activityaggregate: function(data, users) {
		data.users = data.userIds.map(function(id) {
			return users[id]
		})
		return data
	},
	commentaggregate: function(data, users) {
		data.users = data.userIds.map(function(id) {
			return users[id]
		})
		if (data.firstDate)
			data.firstDate = parseDate(data.firstDate)
		if (data.lastDate)
			data.lastDate = parseDate(data.lastDate)
		return data
	},
},
updateAggregateCommentAggregate: function(items, ca, page) {
	var pageMap = {}
	page && page.forEach(function(p) {
		pageMap[p.id] = p
	})
	ca.forEach(function(a) {
		var item = items[a.id]
		if (!item) {
			item = items[a.id] = {
				content: pageMap[a.id],
				users: {},
				firstDate: a.firstDate,
				lastDate: a.firstDate,
				count: 0,
			}
		}
		a.users.forEach(function(user) {
			if (user)
				item.users[user.id] = user
		})
		item.count += a.count
		if (a.firstDate < item.firstDate)
			item.firstDate = a.firstDate
		if (a.lastDate > item.lastDate)
			item.lastDate = a.lastDate
	})
	return items
},
updateAggregateComments: function(items, comments, page) {
	var pageMap = {}
	page && page.forEach(function(p) {
		pageMap[p.id] = p
	})
	comments.forEach(function(c) {
		var id = c.parentId
		var item = items[id]
		if (!item) {
			item = items[id] = {
				content: pageMap[id],
				users: {},
				firstDate: c.editDate,
				lastDate: c.editDate,
				count: 0,
			}
		}
		// todo: commentaggregate only tracks createDate
		// so maybe use that here for consistency between reloads
		if (c.createUser)
			item.users[c.createUser.id] = c.createUser // maybe edituser too?
		item.count++
		if (c.editDate < item.firstDate)
			item.firstDate = c.editDate
		if (c.editDate > item.lastDate)
			item.lastDate = c.editDate
	})
},
updateAggregateActivity: function(items, activity, page) {
	var pageMap = {}
	page && page.forEach(function(p) {
		pageMap[p.id] = p
	})
	activity.forEach(function(a) {
		var id = a.contentId
		var item = items[id]
		if (!item) {
			if (!pageMap[id])
				return
			item = items[id] = {
				content: pageMap[id],
				users: {},
				firstDate: a.date,
				lastDate: a.date,
				count: 0,
			}
		}
		item.users[a.userId] = a.user
		item.count++
		if (a.date < item.firstDate)
			item.firstDate = a.date
		if (a.date > item.lastDate)
			item.lastDate = a.date
	})
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
	var data = str.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}(?:.\d+)?)/)
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
}(window)) //*/ // pass external values
