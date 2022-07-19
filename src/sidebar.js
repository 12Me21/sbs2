'use strict'

const Sidebar = NAMESPACE({
	scroller: null,
	tabs: null,
	$my_avatar: null,
	userlist: new StatusDisplay(0, null),
	
	onload() {
		$openSidebar.onclick = $closeSidebar.onclick = e=>{
			this.toggle()
		}
		new ResizeBar($sidebar, $horizontalResize, 'right', "sidebarWidth")
		new ResizeBar($sidebarTop, $sidebarResize, 'top', "sidebarPinnedHeight", 300)
		View.flag('sidebar', true)
		
		this.scroller = new Scroller($sidebarScroller.parentNode, $sidebarScroller)
		// todo: maybe a global ESC handler?
		/*document.addEventListener('keydown', function(e) {
		  })*/
		let user_label
		if (Req.auth) {
			user_label = document.createElement('span')
			this.$my_avatar = user_label
		} else
			user_label = "log in"
		
		this.tabs = new Tabs([
			{name: 'activity', label: "✨", panel: $sidebarActivityPanel, accesskey: 'a', shadow:true},
			{name: 'watch', label: "🔖", panel: $sidebarWatchPanel, shadow:true},
			//{label: "W", elem: $sidebarWatchPanel},
			
			{name: 'search', label: "🔍", panel: $sidebarNavPanel, onswitch: ()=>{
				$searchInput.value = ""
				$searchInput.focus()
			}, accesskey: 's', shadow:true},
			{name: 'file', label: "📷", panel: $sidebarFilePanel, shadow:true},
			{name: 'user', label: user_label, panel: $sidebarUserPanel},
		], $sidebar_tabs, "sidebar")
		
		if (Req.auth)
			this.tabs.select('activity')
		else
			this.tabs.select('user')
		
		$searchButton.onclick = Draw.event_lock(done=>{
			Lp.chain({
				values: {
					search: `%${$searchInput.value}%`,
					pagetype: [1, 4],
				},
				requests: [
					{type:'content', fields:'name,id,contentType,permissions,createUserId,lastCommentId', query:"contentType in @pagetype AND name LIKE @search", limit:50, order:'lastCommentId_desc'},
				],
			}, resp=>{
				done()
				$searchResults.fill()
				let first = true
				for (let item of resp.content) {
					let bar = document.createElement('a')
					bar.append(Draw.content_label(item))
					bar.setAttribute('role', 'listitem')
					bar.className += " bar rem1-5 search-page ellipsis"
					bar.href = Nav.entity_link(item)
					$searchResults.append(bar)
					bar.tabIndex = first ? 0 : -1
					if (first)
						bar.focus()
					first=false
				}
			})
		})
		View.bind_enter($searchInput, $searchButton.onclick)
		
		$loginForm.onsubmit = ev=>{
			ev.preventDefault()
			Req.get_auth($loginForm.username.value, $loginForm.password.value).do = (resp, err)=>{
				if (err) {
					alert("❌ logging in failed\n"+err)
				} else {
					Req.save_auth(resp)
					alert("✅ logged in!")
					Nav.reload()
				}
			}
		}
		$logOut.onclick = ev=>{
			Req.log_out()
		}
		if (Req.auth) {
			// need to check if logged in, since settings.init() is only called in that case.
			
			Settings.draw($localSettings)
		}
		
		/*let st = new Tabs([
			{name: 'btns', label: "bn", elem: $settings_1},
			{name: 'settings', label: "st", elem: $settings_3},
			{name: 'debug', label: "db", elem: $settings_4},
		], $settings_tabs, "settings")
		st.select('btns')*/
		this.userlist.$elem = $sidebarUserList
		this.userlist.redraw()
	},
	
	printing: false,
	// messy messy messy...
	print(...args) {
		do_when_ready(()=>{
			try {
				if (this.printing) {
					alert("recursive print detected!")
					return
				}
				this.printing = true
				this.scroller.print(inner=>{
					for (let arg of args) {
						try {
							let elem = Debug.sidebar_debug(arg)
							inner.append(elem)
						} catch (e) {
							console.error(e)
							inner.append("error printing!")
						}
						this.message_count++
					}
				}, true)
				this.limit_messages()
			} catch (e) {
				console.error("print error", e, "\n", args)
			}
			this.printing = false
		})
	},
	
	toggle() {
		let fullscreen = this.is_fullscreen()
		if (fullscreen) {
			View.flag('mobileSidebar', !View.flags.mobileSidebar)
		} else {
			View.flag('sidebar', !View.flags.sidebar)
			localStorage.setItem('sbs-sidebar', !!View.flags.sidebar)
		}
	},
	
	is_fullscreen() {
		return window.matchMedia("(max-width: 700px)").matches
	},
	
	close_fullscreen() {
		View.flag('mobileSidebar', false)
	},
	
	message_count: 0,
	
	displayed_ids: {},
	
	display_messages(comments, initial=false) {
		// todo: show page titles?
		this.scroller.print(inner=>{
			for (let c of comments) {
				let old = this.displayed_ids[c.id]
				if (c.deleted) {
					if (old) {
						old.remove()
						delete this.displayed_ids[c.id]
						this.message_count--
					}
				} else if (c.edited) {
					if (old) {
						let nw = Sidebar.draw_comment(c)
						old.replaceWith(nw)
						this.displayed_ids[c.id] = nw
					} else {
					}
				} else {
					let nw = Sidebar.draw_comment(c)
					if (old) {
						// shouldn't happen
						old.replaceWith(nw)
					} else {
						inner.append(nw)
						this.message_count++
					}
					this.displayed_ids[c.id] = nw
				}
			}
		}, !initial)
		this.limit_messages()
		//if (initial)
		//	this.scroller.scroll_instant()
	},
	
	limit_messages() {
		if (this.message_count > 500)
			this.scroller.print_top(inner=>{
				while (this.message_count > 500) {
					let n = inner.firstChild
					let id = n.dataset.id
					if (id)
						delete this.displayed_ids[+id]
					n.remove()
					this.message_count--
				}
			})
	},
	
	draw_comment: function(comment) {
		let d = this()
		d.dataset.id = comment.id
		
		// for bridge messages, display nicknames instead of username
		let author = comment.Author
		let name = author.bridge ? author.nickname+"*" : author.username
		
		d.title = `${name} in ${comment.contentId}:\n${comment.text}`
		// todo: page name 🥺  oh︕ emojis render in italic? don't remember adding that...   we should store refs to pages but like intern them so its not a memory leak...
		
		/*todo: fix,		if (comment.editDate && comment.editUserId!=comment.createUserId) {
		  d.append(
		  entity_title_link(comment.editUser),
		  " edited ",
		  )
		  }*/
		let link = d.firstChild
		link.href = "#user/"+comment.createUserId
		link.firstChild.src = Draw.avatar_url(author)
		link.lastChild.textContent = name
		
		d.append(comment.text.replace(/\n/g, "  "))
		
		return d
	}.bind(𐀶`
<div class='bar rem1-5 ellipsis'>
	<a tabindex=-1 class='user-label'>
		<img class='item avatar' width=100 height=100>
		<span class='textItem entity-title pre'></span>
	</a>:&#32;
</div>
`),
	
	redraw_my_avatar() {
		let icon = Draw.avatar(Req.me)
		this.$my_avatar.fill(icon)
	},
	
	init() {
		Events.messages.listen(this, c=>{
			this.scroller.lock()
			this.display_messages(c)
		})
		Events.after_messages.listen(this, ()=>{
			this.scroller.unlock()
		})
		Events.userlist.listen_id(this, 0, x=>{
			this.userlist.redraw()
		})
		Events.user_edit.listen(this, user=>{
			if (user.id==Req.uid)
				this.redraw_my_avatar()
			this.userlist.redraw_user(user)
		})
	}
})

Sidebar.init()

window.print = Sidebar.print.bind(Sidebar)
Object.defineProperty(window, 'log', {
	configurable: true,
	get() { return window.print },
	set(x) { window.print(x) },
})

do_when_ready(x=>Sidebar.onload())
