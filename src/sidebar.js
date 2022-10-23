'use strict'

const Sidebar = NAMESPACE({
	scroller: null,
	tabs: null,
	$my_avatar: null,
	userlist: new StatusDisplay(0, null),
	
	normal_open: false,
	fullscreen_open: false,
	
	onload() {
		$openSidebar.onclick = $closeSidebar.onclick = e=>{
			this.toggle()
		}
		new ResizeBar($sidebar, $horizontalResize, 'right', "sidebarWidth")
		new ResizeBar($sidebarTop, $sidebarResize, 'top', "sidebarPinnedHeight", 300)
		
		this.normal_open = localStorage.getItem('sbs-sidebar') !== false
		document.documentElement.classList.toggle('f-sidebar', this.normal_open)
		
		this.scroller = new Scroller($sidebarScroller.parentNode, $sidebarScroller)
		// todo: maybe a global ESC handler?
		/*document.addEventListener('keydown', function(e) {
		  })*/
		let user_label
		if (Req.auth) {
			user_label = document.createElement('span')
			let img = document.createElement('img')
			img.width = img.height = 50
			img.className = 'item avatar'
			img.alt = "🔧️"
			user_label.append(img)
			this.$my_avatar = img
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
			{name: 'user', label: user_label, panel: $sidebarUserPanel, shadow:true},
			{name: 'editor', label: null, panel: $sidebarEditorPanel, hidden:true},
			{name: 'popup', label: null, panel: $sidebarPopupPanel, hidden:true},
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
		$login_password.replaceWith(Draw.password_input('password'))
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
	
	output(stuff) {
		let div = document.createElement('div')
		div.className += " debugMessage pre"
		div.append(stuff)
		do_when_ready(()=>{
			try {
				if (this.printing) {
					alert("recursive print detected!")
					return
				}
				this.printing = true
				this.scroller.print(inner=>{
					inner.append(div)
					this.message_count++
				})
				this.limit_messages()
			} finally {
				this.printing = false
			}
		})
		return div
	},
	
	toggle(state=null) {
		let fullscreen = this.is_mobile()
		if (fullscreen) {
			if (state!=null)
				this.fullscreen_open = state
			else
				this.fullscreen_open = !this.fullscreen_open
			document.documentElement.classList.toggle('f-mobileSidebar', this.fullscreen_open)
		} else {
			if (state!=null)
				this.normal_open = state
			else
				this.normal_open = !this.normal_open
			document.documentElement.classList.toggle('f-sidebar', this.normal_open)
			localStorage.setItem('sbs-sidebar', this.normal_open)
		}
	},
	
	is_mobile() {
		return window.matchMedia("(max-width: 700px)").matches
	},
	
	close_fullscreen() {
		this.fullscreen_open = false
		document.documentElement.classList.remove('f-mobileSidebar')
	},
	
	message_count: 0,
	
	displayed_ids: {__proto__:null},
	
	display_messages(comments, initial=false) {
		// ok so the reason this used to break scrolling is:
		// because we DEFER the scroll animation remember!
		this.limit_messages()
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
						// EEEEK
						let nw = Sidebar.draw_comment(c)
						inner.append(nw)
						this.message_count++
						this.displayed_ids[c.id] = nw
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
		d.dataset.pid = comment.contentId
		
		// for bridge messages, display nicknames instead of username
		let author = comment.Author
		let name = author.bridge ? author.nickname+"*" : author.username
		
		d.title = `${name} in [${author.page_name}]:\n${comment.text}`
		
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
<div class='sidebar-comment bar ellipsis'>
	<a tabindex=-1 class='user-label'>
		<img class='item avatar' width=50 height=50>
		<span class='entity-title pre'></span>
	</a>:&#32;
</div>
`),
	
	redraw_my_avatar() {
		this.$my_avatar.src = Draw.avatar_url(Req.me)
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
