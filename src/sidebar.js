'use strict'

let Sidebar = Object.seal({
	scroller: null,
	sidebar_tabs: null,
	$my_avatar: null,
	
	select_tab(name) {
		let tab = this.sidebar_tabs.find(tab=>tab.name==name)
		if (tab)
			switch_tab(tab.btn, true)
	},
	
	onload() {
		$openSidebar.onclick = $closeSidebar.onclick = e=>{
			this.toggle()
		}
		new ResizeBar($sidebar, $horizontalResize, true, -1, "sidebarWidth")
		new ResizeBar($sidebarTop, $sidebarResize, false, 1, "sidebarPinnedHeight", null, 300)
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
		
		this.sidebar_tabs = [
			{name: 'activity', label: "✨", elem: $sidebarActivityPanel, accesskey: 'a'},
			{name: 'watch', label: "W", elem: $sidebarWatchPanel, accesskey: 'w' },
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
			$sidebar_tabs.append(btn)
			
			tab.elem.setAttribute('role', "tabpanel")
			//tab.elem.tabIndex = -1
			tab.elem.setAttribute('aria-labelledby', btn.id)
		}
		
		if (Req.auth)
			this.select_tab('activity')
		else
			this.select_tab('user')
		
		$searchButton.onclick = ev=>{
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
					bar.setAttribute('role', 'listitem')
					$searchResults.append(bar)
					bar.tabIndex = first ? 0 : -1
					if (first)
						bar.focus()
					first=false
				}
			})
		}
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
						try {
							let elem = Debug.sidebar_debug(arg)
							this.scroller.inner.append(elem)
						} catch (e) {
							console.error(e)
							this.scroller.inner.append("error printing!")
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
		this.scroller.print(()=>{
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
				}
			}
		}, !initial)
		this.limit_messages()
		//if (initial)
		//	this.scroller.scroll_instant()
	},
	
	limit_messages() {
		if (this.message_count > 500)
			this.scroller.print_top(()=>{
				while (this.message_count > 500) {
					let n = this.scroller.inner.firstChild
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



let FileUploader = Object.seal({
	file: null,
	last_file: null,
	file_upload_form: null,
	
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
		
		document.addEventListener('paste', e=>{
			let data = e.clipboardData
			if (data && data.files) {
				let file = data.files[0]
				if (file && (/^image\//).test(file.type))
					this.got_file(file)
			}
		})
		document.addEventListener('dragover', e=>{
			if (e.dataTransfer.types.includes("Files"))
				e.preventDefault()
		})
		document.addEventListener('drop', e=>{
			if (e.target instanceof HTMLTextAreaElement)
				return
			let file = e.dataTransfer.files[0]
			if (file) {
				e.preventDefault()
				if (/^image\//.test(file.type))
					this.got_file(file)
			}
		})
		
		//todo: write decoder for xpm :)
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
		$file_url_insert.onclick = e=>{
			let file = this.last_file
			if (!file) return
			if (!View.current.Insert_Text) return
			
			let url = Req.file_url(file.hash)
			
			let meta = JSON.parse(file.meta)
			let markup = Settings.values.chat_markup
			if (markup=='12y') {
				url = "!"+url
				if (meta.width && meta.height)
					url += "#"+meta.width+"x"+meta.height
			} else if (markup=='12y2') {
				url = "!"+url
				if (meta.width && meta.height)
					url += "["+meta.width+"x"+meta.height+"]"
			}
			
			Sidebar.close_fullscreen()
			View.current.Insert_Text(url)
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
				
				this.show_content(file)
			}
		}
		$file_url.onfocus = e=>{
			window.setTimeout(()=>{
				$file_url.select()
			})
		}
	},
	
	show_content(content) {
		let url = Req.file_url(content.hash)
		this.show_parts(2, url, null)
		$file_upload_page.href = "#page/"+content.hash
		this.last_file = content
	},
	
	convert_image(file, quality, callback) {
		let img = new Image()
		img.onload = e=>{
			let canvas = document.createElement('canvas')
			canvas.width = img.width
			canvas.height = img.height
			let c2d = canvas.getContext('2d')
			c2d.drawImage(img, 0, 0)
			URL.revokeObjectURL(img.src)
			let name = file.name
			file = null
			let format = quality!=null ? 'jpeg' : 'png'
			canvas.toBlob(x=>{
				if (x)
					x.name = name+"."+format
				callback(x)
			}, "image/"+format, quality)
		}
		img.onerror = e=>{
			URL.revokeObjectURL(img.src)
			callback(null)
		}
		img.src = URL.createObjectURL(file)
	},
	
	// file is only set if we're uploading a file
	show_parts(phase, url, file) {
		$file_browse.hidden = phase!=0
		$file_cancel.hidden = phase!=1
		$file_upload.hidden = phase!=1
		this.file_upload_form.elem.hidden = phase!=1
		$file_url_insert.hidden = phase!=2
		$file_url.hidden = phase!=2
		$file_done.hidden = phase!=2
		$file_upload_page.hidden = phase!=2
		// we set to "" first, so the old image isnt visible whilst the new one is loading
		$file_image.src = ""
		if (url) {
			$file_image.src = url
			$file_url.value = url
			$file_url.scrollLeft = 999
		} else {
			$file_url.value = ""
		}
		this.file = file || null
	},
	file_cancel() {
		this.show_parts(0, null, null)
	},
	
	got_file(file) {
		if (file.type=='image/webp')
			return this.convert_image(file, 0.7, x=>{
				if (!x) {
					print('image conversion failed!')
					return
				}
				this.got_file(x)
			})
		
		let url = URL.createObjectURL(file)
		this.show_parts(1, url, file)
		URL.revokeObjectURL(url)
		this.file_upload_form.set_some({
			size: (file.size/1000)+" kB",
			name: file.name,
			hash: null,
		})
		this.file_upload_form.write()
		Sidebar.select_tab('file')
	},
})

do_when_ready(x=>FileUploader.onload())
