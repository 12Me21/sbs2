let Sidebar = Object.create(null)
with(Sidebar)((window)=>{"use strict";Object.assign(Sidebar,{
	selected_file: null,
	scroller: null,
	sidebar_tabs: null,
	select_tab: null,
	my_avatar: null,
	file_upload_form: null,
	
	select_tab(name) {
		for (let tab of sidebar_tabs) {
			let select = name==tab.name
			tab.btn.setAttribute('aria-selected', select)
			tab.elem.classList.toggle('shown', select)
			if (select)
				tab.onswitch && tab.onswitch()
		}
	},
	
	onload() {
		file_upload_form = new Form({
			fields: [
				['size', 'output', {output: true, label: "Size"}], //todo: separate set of output fields?
				['name', 'text', {label: "File Name"}],
				['hash', 'text', {label: "Hash"}],
				['bucket', 'text', {label: "Bucket"}],
				['quantize', 'select', {label: "Quantize", default: ""}, {
					options: [["","no"], ["2","2"], ["4","4"], ["8","8"], ["16","16"], ["32","32"], ["64","64"], ["256","256"]]
				}],// todo: maybe store js values in the dropdown, rather than strings?
			]
		})
		$file_upload_form.replaceWith(file_upload_form.elem) // todo: maybe preserve the id on the new element here incase init ... ehhh nah
		file_cancel()
		
		$openSidebar.onclick = $closeSidebar.onclick = toggle
		View.attach_resize($sidebar, $horizontalResize, true, -1, "sidebarWidth")
		View.attach_resize($sidebarTop, $sidebarResize, false, 1, "sidebarPinnedHeight")
		View.flag('sidebar', true)
		
		attach_paste(got_file)
		
		$file_browse.onchange = function(e) { // must not be arrow func
			let file = this.files[0]
			try {
				file && got_file(file)
			} finally {
				this.value = ""
			}
		}
		$file_cancel.onclick = $file_done.onclick = file_cancel
		$file_upload.onclick = function() {
			if (selected_file) {
				$file_upload.disabled = true
				
				file_upload_form.read()
				let data = file_upload_form.get()
				
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
					params.quantize = +data.quantize
				if (data.hash)
					params.hash = data.hash
				if (priv)
					params.globalPerms = ""
				print(`uploading ${priv?"private":"public"} file...`)
				
				new (Req.upload_file(selected_file, params))(file=>{
					$file_upload.disabled = false
					
					if (priv && file.permissions[0])
						alert("file permissions not set correctly!\nid:"+file.id)
					
					selected_file = null
					
					$file_url.hidden = false
					$file_done.hidden = false
					file_upload_form.elem.hidden = true
					$file_browse.hidden = true
					$file_cancel.hidden = true
					$file_upload.hidden = true
					
					$file_url.value = Req.file_url(file.hash)
					$file_image.src = ""
					$file_image.src = Req.file_url(file.hash)
				}, err=>{
					$file_upload.disabled = false
				})
			}
		}
		$file_url.onfocus = function() {
			window.setTimeout(()=>{
				$file_url.select()
			},0)
		}
		scroller = new Scroller($sidebarScroller.parentNode, $sidebarScroller)
		// todo: maybe a global ESC handler?
		/*document.addEventListener('keydown', function(e) {
		  
		  })*/
		let user_label
		if (Req.auth) {
			user_label = document.createElement('span')
			my_avatar = user_label
		} else
			user_label = "log in"
		
		sidebar_tabs = [
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
		
		for (let tab of sidebar_tabs) {
			tab.elem.setAttribute('role', "tabpanel")
			tab.elem.setAttribute('aria-labelledby', `sidebar-tab-${tab.name}`)
			// todo: tabs need like, label? title name thing 
			tab.btn = button_template()
			tab.btn.id = "sidebar-tab-"+tab.name
			tab.btn.setAttribute('aria-controls', tab.elem.id)
			tab.btn.dataset.name = tab.name
			tab.btn.onclick = function(e) {
				select_tab(this.dataset.name)
			}
			tab.btn.append(tab.label)
			if (tab.accesskey)
				tab.btn.setAttribute('accesskey', tab.accesskey)
			$sidebar_tabs.append(tab.btn)
		}
		
		if (Req.auth)
			select_tab('activity')
		else
			select_tab('user')
		
		$searchButton.onclick = ()=>{
			$searchButton.disabled = true
			
			Lp.chain({
				values: {
					search: `%${$searchInput.value}%`,
					pagetype: 1,
				},
				requests: [
					{type:'content', fields:'name,id,contentType,permissions,createUserId,lastCommentId', query:"contentType = @pagetype AND name LIKE @search", limit:50, order:'lastCommentId_desc'},
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
		
		$loginForm.onsubmit = function(e) {
			e.preventDefault()
			new (Req.get_auth($loginForm.username.value, $loginForm.password.value))(
				resp=>{
					Req.save_auth(resp)
					alert("✅ logged in!")
					Nav.reload()
				},
				err=>{
					alert("❌ logging in failed\n"+err)
				}
			)
		}
		$logOut.onclick = function(e) {
			Req.log_out()
		}
		$changeForm.onsubmit = function(e) {
			e.preventDefault()
			registerError("Updating data...", undefined)
			let data = readChangeFields()
			if (data.error) {
				registerError(data.error)
				return
			}
			delete data.error
			Req.set_sensitive(data).then((resp)=>{
				registerError("Updated", undefined)
			}, ()=>{
				registerError(resp, "Failed:") //todo: this doesn't work?
			})
		}
		let d = Draw.settings(Settings)
		$localSettings.append(d.elem)
		$localSettingsSave.onclick = ()=>{
			d.update_all()
		}
	},
	
	attach_paste(callback) {
		document.addEventListener('paste', (event)=>{
			let data = event.clipboardData
			if (data && data.files) {
				let file = data.files[0]
				if (file && (/^image\//).test(file.type))
					callback(file)
			}
		})
	},
	
	redraw_category_tree(cats) {
		$sidebarCategories.fill(Draw.nav_category(cats[0]))
	},
	
	printing: false,
	// messy messy messy...
	print(...args) {
		do_when_ready(()=>{
			try {
				if (printing) {
					alert("recursive print detected!")
					return
				}
				printing = true;
				scroller.print(()=>{
					for (let arg of args) {
						$sidebarScroller.append(Draw.sidebar_debug(arg))
						message_count++
					}
				}, true)
				limit_messages()
			} catch (e) {
				console.error("print error", e, "\n", args)
			}
			printing = false;
		})
	},
	
	file_cancel() {
		selected_file = null
		$file_browse.hidden = false
		$file_cancel.hidden = true
		$file_url.hidden = true
		$file_done.hidden = true
		$file_upload.hidden = true
		file_upload_form.elem.hidden = true
		cleanup()
	},
	
	cleanup() {
		selected_file = null
		$file_image.src = ""
	},
	
	got_file(file) {
		$file_cancel.hidden = false
		$file_upload.hidden = false
		file_upload_form.elem.hidden = false
		$file_browse.hidden = true
		$file_url.hidden = true
		$file_done.hidden = true
		
		$file_image.src = ""
		$file_image.src = URL.createObjectURL(file)
		file_upload_form.set_some({
			size: (file.size/1000)+" kB",
			name: file.name,
			hash: null,
		})
		file_upload_form.write()
		selected_file = file
		select_tab('file')
	},
	
	toggle() {
		let fullscreen = is_fullscreen()
		if (fullscreen) {
			View.flag('mobileSidebar', !View.flags.mobileSidebar)
		} else {
			View.flag('sidebar', !View.flags.sidebar)
			Store.set('sbs-sidebar', !!View.flags.sidebar)
		}
	},
	
	is_fullscreen() {
		return !window.matchMedia || window.matchMedia("(max-width: 700px)").matches
	},
	
	message_count: 0,
	
	displayed_ids: {},
	
	display_messages(comments, initial) {
		// todo: show page titles?
		scroller.print(()=>{
			for (let c of comments) {
				let old = displayed_ids[c.id]
				if (c.deleted) {
					if (old) {
						old.remove()
						delete displayed_ids[c.id]
						message_count--
					}
				} else {
					let nw = Draw.sidebar_comment(c)
					if (old) {
						old.replaceWith(nw)
					} else {
						scroller.inner.append(nw)
						message_count++
					}
					displayed_ids[c.id] = nw
					limit_messages()
				}
			}
		}, !initial)
		if (initial)
			scroller.scroll_instant()
	},
	
	limit_messages() {
		while (message_count > 500) {
			let n = scroller.inner.firstChild
			let id = n.dataset.id
			if (id)
				delete displayed_ids[+id]
			n.remove()
			message_count--
		}
	}
	
})<!-- PRIVATE })

//todo: clean this up
function registerError(message, title) {
	let text = ""
	if (message == undefined)
		text = ""
	else if (message instanceof Array)
		text = message.join("\n")
	else if (typeof message == 'string') {
		text = message
	} else {
		//todo: this tells us which fields are invalid
		// so we can use this to highlight them in red or whatever
		for (let key in message)
			text += key+": "+message[key]+"\n"
	}
	if (title)
		text = title+"\n"+text
	$userSettingsError.textContent = text
}
// this all needs to be replaced with the new input system but I don't trust it enough yet.
function readChangeFields() {
	let form = $changeForm
	let data = {
		oldPassword: form.oldPassword.value,
		username: form.username.value,
		password: form.password.value,
		email: form.email.value
	}
	data.error = {}
	
	if (!data.oldPassword)
		data.error.oldPassword = "Old password is required"
	
	if (!data.username)
		delete data.username
	
	if (data.password) {
		if (data.password != form.password2.value)
			data.error.password2 = "Passwords don't match"
	} else
		delete data.password
	
	if (data.email) {
		if (data.email != form.email2.value)
			data.error.email2 = "Emails don't match"
	} else
		delete data.email
	
	if (!Object.keys(data.error).length)
		data.error = null
	return data
}

0<!-- Sidebar ({
})(window)
Object.seal(Sidebar)

window.print = Sidebar.print
