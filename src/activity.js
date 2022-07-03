'use strict'

class ActivityItem {
	constructor(content, parent) {
		this.parent = parent
		this.content = content
		this.users = {}
		this.date = "0"
		this.elem = this.constructor.HTML()
		this.user_elem = this.elem.lastChild.lastChild
		this.page_elem = this.elem.firstChild
		this.time_elem = this.elem.lastChild.firstChild
		this.redraw_page()
		this.top()
	}
	redraw_page() {
		this.elem.href = Nav.entity_link(this.content)
		this.page_elem.fill(Draw.content_label(this.content))
	}
	top() {
		let first = this.parent.container.firstElementChild
		if (first == this.elem)
			return
		this.parent.container.prepend(this.elem)
		if (this.parent.container.contains(document.activeElement))
			return
		let hole = this.parent.container.querySelector(`:scope > [tabindex="0"]`)
		if (hole)
			hole.tabIndex = -1
		this.elem.tabIndex = 0
	}
	redraw_time() {
		if (!this.date) return
		this.time_elem.textContent = Draw.time_ago_string(this.date)
	}
	update_date(date) {
		if (date > this.date) {
			this.date = date
			this.time_elem.title = this.date.toString()
			this.time_elem.setAttribute('datetime', this.date.toISOString())
			this.redraw_time()
			this.top()
		}
	}
	update_content(content) {
		if (content.lastRevisionId > this.content.lastRevisionId) {
			this.content = content
			this.redraw_page()
		}
	}
	update_user(uid, user, date) {
		// hmm user is almost identical to ActivityItem. could reuse class for both?
		if (!user) {
			//console.warn('update user uid?', uid)
			return
		}
		let u = this.users[uid] || (this.users[uid] = {user, date:"0", elem: Draw.link_avatar(user)})
		// todo: show user dates on hover?
		if (date > u.date) { // todo: update user object. why don't users have editDate...
			if (u.date=="0" || u.elem.previousSibling) // hack
				this.user_elem.prepend(u.elem)
			u.date = date
		}
	}
}
ActivityItem.get = function(map, id, content, date, parent) {
	let item = map[id] || (map[id] = new this(content, parent))
	item.update_content(content)
	item.update_date(date)
	return item
}
ActivityItem.handle = function(map, pid, content, uid, user, date, parent) {
	let item = this.get(map, pid, content[~pid], date, parent)
	item.update_user(uid, user[~uid], date)
}
ActivityItem.HTML = 𐀶`
<a class='activity-page' role=row tabindex=-1>
	<div class='bar rem1-5 ellipsis'></div>
	<div class='bar rem1-5 activity-page-bottom ROW'>
		<time class='time-ago ellipsis'></time>
		<activity-users aria-orientation=horizontal class='FILL'>
`

class ActivityContainer {
	constructor(element_name) {
		this.container = document.createElement('scroll-inner')
		this.interval = null
		this.container.setAttribute('role', 'treegrid')
		this.elem = null
		this.items = {}
	}

	init(element) {
		do_when_ready(()=>{
			this.elem = document.getElementById(element)
			this.elem.fill(this.container)
			this.refresh_time_interval()
		})		
	}

	refresh_time_interval() {
		if (this.interval)
			window.clearInterval(this.interval)
		this.interval = window.setInterval(()=>{
			for (let item of Object.values(this.items))
				item.redraw_time()
		}, 1000*30)
	}

	watch(
		watch,
		{content, user}		
	) {
		const pid = watch.contentId
		const uid = null
		const date = watch.Message ? watch.Message.createDate2 : null
		ActivityItem.handle(this.items, pid, content, uid, user, date, this)
	}
	
	message_aggregate(
		{contentId:pid, createUserId:uid, maxCreateDate2:date},
		{content, user}
	) {
		ActivityItem.handle(this.items, pid, content, uid, user, date, this)
	}
	
	message(
		{contentId:pid, createUserId:uid, createDate2:date, deleted},
		{content, user}
	) {
		if (deleted) return // mmnn
		ActivityItem.handle(this.items, pid, content, uid, user, date, this)
	}
}

const Act = new ActivityContainer()
Act.init("$sidebarActivity")

const WatchAct = new ActivityContainer()
WatchAct.init("$sidebarWatch")

function pull_recent() {
	let start = new Date()
	start.setDate(start.getDate() - 1)
	Lp.chain({
		values: {
			yesterday: start,
		},
		requests: [
			{type:'message_aggregate', fields:'contentId, createUserId, maxCreateDate, maxId', query:"createDate > @yesterday"},
			{type:'watch', fields:'*', order:'lastCommentId'},
			{type:'message', fields:'*', query:"!notdeleted()", order:'id_desc', limit:50},
			{type:'message', fields:'*', query:"id IN @watch.lastCommentId", order: 'id_desc', name: 'Mwatch'},
			{type:'content', fields:'name, id, permissions, contentType, lastRevisionId', query:"id IN @message_aggregate.contentId OR id IN @message.contentId OR id IN @watch.contentId"},
			{type:'user', fields:'*', query:"id IN @message_aggregate.createUserId OR id IN @message.createUserId OR id IN @watch.userId"},
			// todo: activity_aggregate
		],
	}, (objects)=>{
		Entity.link_comments({message:objects.Mwatch, user:objects.user})
		Entity.link_watch({message:objects.Mwatch, watch:objects.watch})
		console.log("mwatch", objects.watch)
		console.log('🌄 got initial activity')
		console.log('watch', objects.watch)
		Entity.ascending(objects.message, 'id')
		Sidebar.display_messages(objects.message, true) // TODO: ensure that these are displayed BEFORE any websocket new messages
		console.log('aggregate', objects.message_aggregate);
		objects.message_aggregate.sort((a, b)=>a.maxId-b.maxId)
		for (let x of objects.message_aggregate)
			Act.message_aggregate(x, objects)
		for (let x of objects.watch)
			WatchAct.watch(x, objects)
	})
}

