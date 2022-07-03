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
		const con = this.parent.container
		let first = con.firstElementChild
		if (first == this.elem)
			return
		con.prepend(this.elem)
		if (con.contains(document.activeElement))
			return
		let hole = con.querySelector(`:scope > [tabindex="0"]`)
		if (hole)
			hole.tabIndex = -1
		this.elem.tabIndex = 0
	}
	redraw_time() {
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
		if (!user || this.parent.hide_user) {
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
ActivityItem.HTML = 𐀶`
<a class='activity-page' role=row tabindex=-1>
	<div class='bar rem1-5 ellipsis'></div>
	<div class='bar rem1-5 activity-page-bottom ROW'>
		<time class='time-ago ellipsis'></time>
		<activity-users aria-orientation=horizontal class='FILL'>
`

class ActivityContainer {
	constructor(hide_user=false) {
		this.container = document.createElement('scroll-inner')
		this.interval = null
		this.container.setAttribute('role', 'treegrid')
		this.elem = null
		this.items = {}
		this.hide_user = hide_user
	}
	
	init(element) {
		this.elem = element
		this.elem.fill(this.container)
		this.refresh_time_interval()
	}
	
	refresh_time_interval() {
		if (this.interval)
			window.clearInterval(this.interval)
		this.interval = window.setInterval(()=>{
			for (let item of Object.values(this.items))
				item.redraw_time()
		}, 1000*30)
	}
	
	// get/create the ActivityItem for a given page
	//  - also updates its page and date info
	// (the reason i pass pid AND page here, is just in case the
	//  page data is missing, so we'll at least have the id)
	update_content(pid, page, date) {
		let item = this.items[pid] || (this.items[pid] = new ActivityItem(page, this))
		item.update_content(page)
		item.update_date(date)
		return item
	}
	// update page, date, and user info, for a given page
	update({content, user}, pid, uid, date) {
		let item = this.update_content(pid, content[~pid], date)
		if (uid)
			item.update_user(uid, user[~uid], date)
	}
	
	watch(
		watch,
		objects
	) {
		const pid = watch.contentId
		const msg = watch.Message // in case page has 0 messages:
		const date = msg ? msg.createDate2 : watch.editDate2
		this.update(objects, pid, null, date)
	}
	
	message_aggregate(
		{contentId:pid, createUserId:uid, maxCreateDate2:date},
		objects
	) {
		this.update(objects, pid, uid, date)
	}
	
	message(
		{contentId:pid, createUserId:uid, createDate2:date, deleted},
		objects
	) {
		if (deleted) return // mmnn
		this.update(objects, pid, uid, date)
	}
}

const Act = new ActivityContainer()
const WatchAct = new ActivityContainer(true)
do_when_ready(()=>{
	Act.init($sidebarActivity)
	WatchAct.init($sidebarWatch)
})

function pull_recent() {
	let start = new Date()
	start.setDate(start.getDate() - 1)
	Lp.chain({
		values: {
			yesterday: start,
		},
		requests: [
			// recent messages
			{type:'message_aggregate', fields:'contentId, createUserId, maxCreateDate, maxId', query:"createDate > @yesterday"},
			{type:'message', fields:'*', query:"!notdeleted()", order:'id_desc', limit:50},
			{type:'content', fields:'name, id, permissions, contentType, lastRevisionId', query:"id IN @message_aggregate.contentId OR id IN @message.contentId"},
			// watches
			{type:'watch', fields:'*'},
			{name:'Cwatch', type:'content', fields:'name, id, permissions, contentType, lastRevisionId,lastCommentId', query: "!notdeleted() AND id IN @watch.contentId", order:'lastCommentId_desc'},
			{name:'Mwatch', type:'message', fields: '*', query: 'id in @Cwatch.lastCommentId', order: 'id_desc'},
			// shared
			{type:'user', fields:'*', query:"id IN @message_aggregate.createUserId OR id IN @message.createUserId OR id IN @watch.userId"},
			// todo: activity_aggregate
		],
	}, (objects)=>{
		console.log('🌄 got initial activity')
		Entity.link_comments({message:objects.Mwatch, user:objects.user})
		Entity.ascending(objects.message, 'id')
		// TODO: ensure that these are displayed BEFORE any websocket new messages
		Sidebar.display_messages(objects.message, true)
		objects.message_aggregate.sort((a, b)=>a.maxId-b.maxId)
		for (let x of objects.message_aggregate)
			Act.message_aggregate(x, objects)
		// watches
		Entity.link_watch({message:objects.Mwatch, watch:objects.watch, content:objects.Cwatch})
		objects.watch.sort((x, y)=>x.Message.id-y.Message.id)
		for (let x of objects.watch)
			WatchAct.watch(x, {content:objects.Cwatch})
	})
}

