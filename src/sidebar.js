'use strict'
delete window.sidebar // obsolete firefox global variable

let Sidebar = Object.seal({
	file: null,
	scroller: null,
	sidebar_tabs: null,
	my_avatar: null,
	file_upload_form: null,
	
	select_tab(name) {
		let tab = this.sidebar_tabs.find(tab=>tab.name==name)
		if (tab)
			switch_tab(tab.btn, true)
	},
	
	onload() {
		this.file_upload_form = new Form({
			fields: [
				['size', 'output', {label: "Size"}], //todo: separate set of output fields?
				['name', 'text', {label: "File Name"}],
				['hash', 'text', {label: "Hash"}],
				['bucket', 'text', {label: "Bucket"}],
				['quantize', 'select', {
					options: [null, 2, 4, 8, 16, 32, 64, 256],
					label: "Quantize",
					option_labels: ["no", "2", "4", "8", "16", "32", "64", "256"],
				}],
			],
		})
		$file_upload_form.replaceWith(this.file_upload_form.elem)
		this.file_cancel()
		
		$openSidebar.onclick = $closeSidebar.onclick = e=>{
			this.toggle()
		}
		View.attach_resize($sidebar, $horizontalResize, true, -1, "sidebarWidth")
		View.attach_resize($sidebarTop, $sidebarResize, false, 1, "sidebarPinnedHeight", null, 300)
		View.flag('sidebar', true)
		
		document.addEventListener('paste', e=>{
			let data = e.clipboardData
			if (data && data.files) {
				let file = data.files[0]
				if (file && (/^image\//).test(file.type))
					this.got_file(file)
			}
		})
		
		$file_browse.onchange = e=>{
			let file = $file_browse.files[0]
			try {
				file && this.got_file(file)
			} finally {
				$file_browse.value = ""
			}
		}
		$file_cancel.onclick = $file_done.onclick = e=>{
			this.file_cancel()
		}
		$file_upload.onclick = e=>{
			if (!this.file) return
			$file_upload.disabled = true
			
			this.file_upload_form.read()
			let data = this.file_upload_form.get()
			
			let params = {
				tryresize: true,
				name: data.name || "",
				values: {},
			}
			let priv = false
			if (data.bucket!=null) {
				params.values.bucket = data.bucket || ""
				priv = true
			}
			if (data.quantize)
				params.quantize = data.quantize
			if (data.hash)
				params.hash = data.hash
			if (priv)
				params.globalPerms = ""
			print(`uploading ${priv?"private":"public"} file...`)
			
			Req.upload_file(this.file, params).do = (file, err)=>{
				$file_upload.disabled = false
				if (err) return
				
				if (priv && file.permissions[0])
					alert("file permissions not set correctly!\nid:"+file.id)
				
				this.file = null
				
				$file_url.hidden = false
				$file_done.hidden = false
				this.file_upload_form.elem.hidden = true
				$file_browse.hidden = true
				$file_cancel.hidden = true
				$file_upload.hidden = true
				
				$file_url.value = Req.file_url(file.hash)
				$file_image.src = ""
				$file_image.src = Req.file_url(file.hash)
			}
		}
		$file_url.onfocus = e=>{
			window.setTimeout(()=>{
				$file_url.select()
			})
		}
		this.scroller = new Scroller($sidebarScroller.parentNode, $sidebarScroller)
		// todo: maybe a global ESC handler?
		/*document.addEventListener('keydown', function(e) {
		  
		  })*/
		let user_label
		if (Req.auth) {
			user_label = document.createElement('span')
			this.my_avatar = user_label
		} else
			user_label = "log in"
		
		this.sidebar_tabs = [
			{name: 'activity', label: "✨", elem: $sidebarActivityPanel, accesskey: 'a'},
			//{label: "W", elem: $sidebarWatchPanel},
			
			{name: 'search', label: "🔍", elem: $sidebarNavPanel, onswitch: ()=>{
				$searchInput.value = ""
				$searchInput.focus()
			}, accesskey: 's'},
			{name: 'file', label: "📷", elem: $sidebarFilePanel},
			{name: 'user', label: user_label, elem: $sidebarUserPanel},
		]
		
		let button_template = 𐀶`<button role=tab aria-selected=false>`
		
		for (let tab of this.sidebar_tabs) {
			let btn = tab.btn = button_template()
			btn.id = "sidebar-tab-"+tab.name
			btn.setAttribute('aria-controls', tab.elem.id)
			btn.setAttribute('tabindex', "-1")
			btn.dataset.name = tab.name
			btn.onclick = e=>{
				switch_tab(btn)
				if (tab.onswitch)
					tab.onswitch()
			}
			btn.append(tab.label)
			if (tab.accesskey)
				btn.setAttribute('accesskey', tab.accesskey)
			$sidebar_tabs.append(btn)
			
			tab.elem.setAttribute('role', "tabpanel")
			//tab.elem.setAttribute('tabindex', "0")
			tab.elem.setAttribute('aria-labelledby', btn.id)
		}
		
		if (Req.auth)
			this.select_tab('activity')
		else
			this.select_tab('user')
		
		$searchButton.onclick = e=>{
			$searchButton.disabled = true
			
			Lp.chain({
				values: {
					search: `%${$searchInput.value}%`,
					pagetype: [1, 4],
				},
				requests: [
					{type:'content', fields:'name,id,contentType,permissions,createUserId,lastCommentId', query:"contentType in @pagetype AND name LIKE @search", limit:50, order:'lastCommentId_desc'},
				],
			}, resp=>{
				$searchButton.disabled = false
				$searchResults.fill()
				let first = true
				for (let item of resp.content) {
					let bar = Draw.content_label(item, true)
					$searchResults.append(bar)
					if (first)
						bar.focus()
					first=false
				}
			})
		}
		View.bind_enter($searchInput, $searchButton.onclick)
		
		$loginForm.onsubmit = e=>{
			e.preventDefault()
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
		$logOut.onclick = e=>{
			Req.log_out()
		}
		let d = Draw.settings(Settings)
		$localSettings.append(d.elem)
		$localSettingsSave.onclick = ()=>{
			d.update_all()
		}
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
				this.scroller.print(()=>{
					for (let arg of args) {
						$sidebarScroller.append(Draw.sidebar_debug(arg))
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
	
	file_cancel() {
		this.file = null
		$file_browse.hidden = false
		$file_cancel.hidden = true
		$file_url.hidden = true
		$file_done.hidden = true
		$file_upload.hidden = true
		this.file_upload_form.elem.hidden = true
		this.file = null
		$file_image.src = ""
	},
	
	got_file(file) {
		$file_cancel.hidden = false
		$file_upload.hidden = false
		this.file_upload_form.elem.hidden = false
		$file_browse.hidden = true
		$file_url.hidden = true
		$file_done.hidden = true
		
		$file_image.src = ""
		$file_image.src = URL.createObjectURL(file)
		this.file_upload_form.set_some({
			size: (file.size/1000)+" kB",
			name: file.name,
			hash: null,
		})
		this.file_upload_form.write()
		this.file = file
		this.select_tab('file')
	},
	
	toggle() {
		let fullscreen = this.is_fullscreen()
		if (fullscreen) {
			View.flag('mobileSidebar', !View.flags.mobileSidebar)
		} else {
			View.flag('sidebar', !View.flags.sidebar)
			Store.set('sbs-sidebar', !!View.flags.sidebar)
		}
	},
	
	is_fullscreen() {
		return window.matchMedia("(max-width: 700px)").matches
	},
	
	message_count: 0,
	
	displayed_ids: {},
	
	display_messages(comments, initial) {
		// todo: show page titles?
		this.scroller.print(()=>{ //todo: pass inner as arg here
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
						this.scroller.inner.append(nw)
						this.message_count++
					}
					this.displayed_ids[c.id] = nw
					this.limit_messages()
				}
			}
		}, !initial)
		if (initial)
			this.scroller.scroll_instant()
	},
	
	limit_messages() {
		while (this.message_count > 500) {
			let n = this.scroller.inner.firstChild
			let id = n.dataset.id
			if (id)
				delete this.displayed_ids[+id]
			n.remove()
			this.message_count--
		}
	},
	
})

window.print = Sidebar.print.bind(Sidebar)
