'use strict'

function date_order(date) {
	if (date instanceof Date)
		return (1420070400000-date.getTime()) / 1000 |0
	return 100
}

class ActivityItem {
	constructor(content, parent) {
		if (parent.hide_user)
			ActivityItem.template_simple(this)
		else
			ActivityItem.template(this)
		
		this.parent = parent
		this.content = content
		this.users = {__proto__:null}
		this.action_users = {__proto__:null}
		this.date = -Infinity
		
		if (this.content) {
			this.$root.dataset.pid = this.content.id
			this.$root.href = Nav.entity_link(this.content)
			this.redraw_page()
		}
		this.parent.$container.append(this.$root)
	}
	redraw_page() {
		this.$page.fill(Draw.content_label(this.content))
	}
	redraw_time() {
		if (this.date!=-Infinity)
			this.$time.textContent = Draw.time_ago_string(this.date)
	}
	update_date(date) {
		if (date > this.date) {
			this.date = date
			this.$time.title = this.date.toString()
			this.$time.setAttribute('datetime', this.date.toISOString())
			this.redraw_time()
			this.$root.style.order = date_order(this.date)
		}
	}
	update_content(content) {
		if (!this.content || content.lastRevisionId > this.content.lastRevisionId) {
			this.content = content
			this.redraw_page()
		}
	}
	update_user(uid, user, date, action=null) {
		// hmm user is almost identical to ActivityItem. could reuse class for both?
		if (!user || this.parent.hide_user) {
			//console.warn('update user uid?', uid)
			return
		}
		// todo: update user object for avatar changes etc? why don't users have editDate...
		let umap = action ? this.action_users : this.users
		let u = umap[uid]
		if (!u) {
			let elem = Draw.link_avatar(user)
			if (action)
				elem.classList.add('action-user')
			u = umap[uid] = {user, date: -Infinity, elem}
			this.$user.append(u.elem)
		}
		// todo: show user dates on hover?
		if (date > u.date) {
			u.date = date
			u.elem.style.order = date_order(u.date)
		}
	}
}
ActivityItem.template = HTML`
<a class='activity-page' role=row tabindex=-1>
	<div $=page class='bar rem1-5 ellipsis'></div>
	<div class='bar rem1-5 activity-page-bottom ROW'>
		<time $=time class='time-ago ellipsis'></time>
		<div class='activity-users' $=user aria-orientation=horizontal data-ordered>
`
ActivityItem.template_simple = HTML`
<a class='activity-page activity-watch' role=row tabindex=-1>
	<div $=page class='bar rem1-5 ellipsis'></div>
	<div class='bar rem1-5 activity-page-bottom ROW'>
		<time $=time class='time-ago ellipsis'></time>
`

class ActivityContainer {
	constructor(hide_user=false) {
		this.$container = document.createElement('scroll-inner')
		this.$container.dataset.ordered = ""
		this.$container.tabIndex = 0
		//this.$container.setAttribute('role', 'treegrid')
		this.$elem = null
		this.interval = null
		this.items = {__proto__:null}
		this.hide_user = hide_user
	}
	
	init(element) {
		// this should probably be handled by um  sidebar instead
		this.$elem = element
		this.$elem.fill(this.$container)
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
	update({content, user}, pid, date, uid=null, action=null) {
		let page = content[~pid]
		if (!page)
			page = TYPES.content({id: pid||0})
		// ignore activity on files, and deletions
		if (action && (page.contentType==CODES.InternalContentType.file || action==CODES.UserAction.delete))
			return
		let item = this.update_content(pid, page, date)
		if (uid)
			item.update_user(uid, user[~uid], date, action)
	}
	
	watch(watch, objects) {
		const pid = watch.contentId
		const msg = watch.Message // in case page has 0 messages:
		const date = msg.id ? msg.Author.date : -Infinity
		this.update(objects, pid, date)
	}
	
	message_aggregate(agg, objects) {
		this.update(objects, agg.contentId, agg.maxCreateDate2, agg.createUserId)
	}
	
	message(msg, objects) {
		if (msg.deleted || msg.edited) // not sure about edited. maybe use editDate ehhh...
			return
		this.update(objects, msg.contentId, msg.Author.date, msg.createUserId)
	}
	
	activity(act, objects) {
		let d = act.date2
		if (d >= 1658491594041 && d <= 1658638103040)
			return
		this.update(objects, act.contentId, d, act.userId, act.action)
	}
}

let Act = {
	normal: new ActivityContainer(false),
	watch: new ActivityContainer(true),
	init() {
		this.normal.init($sidebarActivity)
		this.watch.init($sidebarWatch)
	},
	pull_recent() {
		let start = new Date()
		start.setDate(start.getDate() - 1)
		Lp.chain({
			values: {
				yesterday: start,
			},
			requests: [
				// recent messages to show in sidebar
				{type:'message', fields:'*', query:"!notdeleted()", order:'id_desc', limit:50},
				// message aggregate
				{type:'message_aggregate', fields:'contentId,createUserId,maxCreateDate,maxId', query:"createDate > @yesterday"},
				// activity
				{type:'activity', fields:'id,contentId,userId,action,date', query:"date > @yesterday AND !basichistory()", order:'id'},
				// watches
				{type:'watch', fields:'*'},
				{name:'Cwatch', type:'content', fields:'name,id,permissions,contentType,lastRevisionId,lastCommentId,hash,values', query: "!notdeleted() AND id IN @watch.contentId", order:'lastCommentId_desc'},
				{name:'Mwatch', type:'message', fields: '*', query: 'id in @Cwatch.lastCommentId', order: 'id_desc'},
				// shared
				{type:'user', fields:'*', query:"id IN @message_aggregate.createUserId OR id IN @message.createUserId OR id IN @watch.userId OR id IN @activity.userId"},
				{type:'content', fields:'name,id,permissions,contentType,lastRevisionId,hash,literalType,values', query:"id IN @message_aggregate.contentId OR id IN @message.contentId OR id IN @activity.contentId"},
				// category
				{name:'Ccat', type:'content', fields:'name,id,permissions,contentType,literalType,parentId,hash,values', query:"!onlyparents() OR literalType={{category}}"},
			],
		}, (objects)=>{
			console.log('🌄 got initial activity')
			/// process data ///
			Entity.link_comments({message:objects.Mwatch, user:objects.user, content:objects.content})
			Entity.ascending(objects.message, 'id')
			
			/// sidebar messages ///
			// TODO: ensure that these are displayed BEFORE any websocket new messages
			Sidebar.display_messages(objects.message, true)
			
			/// activity tab ///
			for (let act of objects.activity)
				this.normal.activity(act, objects)
			for (let agg of objects.message_aggregate)
				this.normal.message_aggregate(agg, objects)
			
			// watch
			Entity.link_watch({message:objects.Mwatch, watch:objects.watch, content:objects.Cwatch})
			for (let x of objects.watch)
				this.watch.watch(x, {content:objects.Cwatch})
			
			// cats
			let tree = {content:null, branches:[]}
			let map = {'0':tree}
			for (let cat of objects.Ccat) {
				map[cat.id] = {content:cat, branches:[]}
			}
			for (let cat of objects.Ccat) {
				let parent = map[cat.parentId]
				if (parent)
					parent.branches.push(map[cat.id])
			}
			function draw_tree(root, depth=0, last=false) {
				let cat = root.content
				if (cat) {
					if (cat.id==23)
						return //sowwy
					let bar = document.createElement('a')
					bar.append(Draw.content_label(cat))
					bar.setAttribute('role', 'listitem')
					bar.className += " bar rem1-5 search-page ellipsis"
					// bar.href = Nav.entity_link(cat)
					// workaround
					bar.href = "#category/" + cat.id
					bar.prepend("│ ".repeat(depth-1)+"├└"[last?1:0])
					$sidebarCategories.append(bar)
				}
				root.branches.forEach((x,i,a)=>draw_tree(x,depth+1,i==a.length-1))
			}
			draw_tree(tree)
		})
	},
	handle_messages(comments, maplist) {
		for (let msg of comments) {
			if (!msg.deleted) {
				let pid = msg.contentId
				let date = msg.Author.date
				this.normal.update(maplist, pid, date, msg.createUserId)
				if (this.watch.items[pid])
					this.watch.update(maplist, pid, date)
			}
		}
	},
}
do_when_ready(()=>{Act.init()})

Events.messages.listen(Act, Act.handle_messages)
