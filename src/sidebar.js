'use strict'

let button_template = 𐀶`<button role=tab aria-selected=false>`

class Tabs {
	constructor(def, elem=document.createElement('tab-list'), name=Tabs.id++) {
		
		this.tabs = def
		this.elem = elem
		
		this.elem.setAttribute('role', 'tablist')
		for (let tab of this.tabs) {
			if (!tab.elem.id)
				tab.elem.id = name+"-panel-"+tab.name
			
			let btn = tab.btn = button_template()
			btn.id = name+"-tab-"+tab.name
			btn.setAttribute('aria-controls', tab.elem.id)
			btn.tabIndex = -1
			btn.dataset.name = tab.name
			btn.onclick = e=>{
				switch_tab(btn)
				if (tab.onswitch)
					tab.onswitch()
			}
			btn.append(tab.label)
			if (tab.accesskey)
				btn.setAttribute('accesskey', tab.accesskey)
			this.elem.append(btn)
			
			tab.elem.setAttribute('role', "tabpanel")
			//tab.elem.tabIndex = -1
			tab.elem.setAttribute('aria-labelledby', btn.id)
		}
	}
	select(name) {
		let tab = this.tabs.find(tab=>tab.name==name)
		if (tab)
			switch_tab(tab.btn, true)
	}
}
Tabs.id = 1

const Sidebar = NAMESPACE({
	scroller: null,
	tabs: null,
	$my_avatar: null,
	
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
			{name: 'activity', label: "✨", elem: $sidebarActivityPanel, accesskey: 'a'},
			{name: 'watch', label: "🔖", elem: $sidebarWatchPanel, accesskey: 'w' },
			//{label: "W", elem: $sidebarWatchPanel},
			
			{name: 'search', label: "🔍", elem: $sidebarNavPanel, onswitch: ()=>{
				$searchInput.value = ""
				$searchInput.focus()
			}, accesskey: 's'},
			{name: 'file', label: "📷", elem: $sidebarFilePanel},
			{name: 'user', label: user_label, elem: $sidebarUserPanel},
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
					bar.classList.add('bar')
					bar.classList.add('rem1-5')
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
			
			$localSettingsSave.onclick = ev=>{
				Settings.save_all()
			}
		}
		
		/*let st = new Tabs([
			{name: 'btns', label: "bn", elem: $settings_1},
			{name: 'settings', label: "st", elem: $settings_3},
			{name: 'debug', label: "db", elem: $settings_4},
		], $settings_tabs, "settings")
		st.select('btns')*/
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
	
	display_messages(comments, initial) {
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
				} else {
					let nw = Draw.sidebar_comment(c)
					if (old) {
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
	
})

window.print = Sidebar.print.bind(Sidebar)
Object.defineProperty(window, 'log', {
	configurable: true,
	get() { return window.print },
	set(x) { window.print(x) },
})

do_when_ready(x=>Sidebar.onload())
