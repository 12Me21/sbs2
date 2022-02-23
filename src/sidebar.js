let Sidebar = Object.create(null)
with(Sidebar)((window)=>{"use strict";Object.assign(Sidebar,{
	
	selected_file: null,
	
	scroller: null,
	pre_print: [],
	
	select_tab: null,
	
	my_avatar: null,
	
	file_upload_form: null,
	
	interval: null,
	refresh_time_interval(data) { //unused parameter
		if (interval)
			window.clearInterval(interval)
		interval = window.setInterval(()=>{
			Draw.update_timestamps($sidebarActivity)
		}, 1000*30)
	},
	
	init() {
		file_upload_form = new Form({
			fields: [
				['size', 'output', {output: true, label: "Size"}], //todo: separate set of output fields?
				['name', 'text', {label: "File Name"}],
				['bucket', 'text', {label: "Bucket"}],
				['quantize', 'select', {label: "Quantize", default: ""}, {
					options: [["","no"], ["2","2"], ["4","4"], ["8","8"], ["16","16"], ["32","32"], ["64","64"], ["256","256"]] //todo: check which quantization levels are actually allowed
				}],// todo: maybe store js values in the dropdown, rather than strings?
			]
		})
		$file_upload_form.replaceWith(file_upload_form.elem) // todo: maybe preserve the id on the new element here incase init ... ehhh nah
		file_cancel()
		
		$openSidebar.onclick = $closeSidebar.onclick = toggle
		View.attach_resize($sidebar, $sidebarResize, true, -1, "sidebarWidth")
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
				
				let data = file_upload_form.get()
				let params = {
					bucket: data.bucket,
					name: data.name,
					tryresize: true,
				}
				if (data.quantize)
					params.quantize = +data.quantize
				
				Req.upload_file(selected_file, params, (e, file)=>{
					$file_upload.disabled = false
					if (e) // failed
						return
					selected_file = null
					
					$file_url.hidden = false
					$file_done.parentNode.hidden = false
					file_upload_form.elem.hidden = true
					$file_browse.hidden = true
					$file_cancel.parentNode.hidden = true
					$file_upload.parentNode.hidden = true
					
					$file_url.value = Req.file_url(file.id)
					$file_image.src = ""
					$file_image.src = Req.file_url(file.id)
				})
			}
		}
		$file_url.onclick = function() { $file_url.select() }
		scroller = new Scroller($sidebarScroller.parentNode, $sidebarScroller)
		pre_print.forEach((x)=> print(x) )
		pre_print = null
		// todo: maybe a global ESC handler?
		/*document.addEventListener('keydown', function(e) {
		  
		  })*/
		let x = document.createDocumentFragment()
		let y = x.createChild('span')
		my_avatar = x.createChild('span')
		my_avatar.className += " loggedIn fill"
		y.className += " loggedOut"
		y.textContent = "log in"
		let sidebar_tabs = Draw.sidebar_tabs([
			{label: document.createTextNode("✨"), elem: $sidebarActivityPanel},
			{label: document.createTextNode("W"), elem: $sidebarWatchPanel},
			{label: document.createTextNode("🔍"), elem: $sidebarNavPanel},
			{label: document.createTextNode("📷"), elem: $sidebarFilePanel},
			{label: x, elem: $sidebarUserPanel},
		])
		$sidebar_tabs.replaceChildren(sidebar_tabs.elem)
		sidebar_tabs.select(0)
		select_tab = sidebar_tabs.select
		
		$searchButton.onclick = ()=>{
			$searchButton.disabled = true
			Req.search1($searchInput.value, (users, pages)=>{
				$searchButton.disabled = false
				$searchResults.replaceChildren()
				pages.forEach((item)=>{
					let bar = Draw.page_bar(item)
					bar.className += " linkBar bar rem1-5"
					$searchResults.append(bar)
				})
				users.forEach((item)=>{
					let bar = Draw.entity_title_link(item)
					bar.className += " linkBar bar rem1-5"
					$searchResults.append(bar)
				})
			})
		}
		View.bind_enter($searchInput, $searchButton.onclick)
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
	
	// this needs to be optimized
	// it redraws the entire list of pages in activity + watching, EVERY time they update
	// TODO
	// TODO TODO
	on_aggregate_change(aggregate) {
		let items = Object.values(aggregate).filter(a=>a.content) //HACK (what did i mean by this?)
		items.sort((a, b)=> -(a.lastDate - b.lastDate))
		$sidebarActivity.childs = null
		$sidebarWatch.childs = null
		for (let item of items) {
			$sidebarActivity.append(Draw.activity_item(item))
			if (item.watching)
				$sidebarWatch.append(Draw.activity_item(item))
		}
		refresh_time_interval(aggregate)
	},
	
	redraw_category_tree(cats) {
		$sidebarCategories.childs = Draw.nav_category(cats[0])
	},
	
	print(...args) {
		let text = args.map((str)=>{
			// wtf is this
			try {
				try {
					return String(str)
				} catch(e) {
					return "<"+str.constructor.name+">" // todo: breaks on {} with no constructor now
				}
			} catch(e) {
				return "<???>"
			}
		}).join("\n")
		if (scroller)
			scroller.print(()=>{
				message_count++
				limit_messages()
				return Draw.sidebar_debug(text)
			}, true)
		else
			pre_print.push(text)
	},
	
	file_cancel() {
		selected_file = null
		$file_browse.hidden = false
		$file_cancel.parentNode.hidden = true // parentnode because buttoncontainer.. messy todo
		$file_url.hidden = true
		$file_done.parentNode.hidden = true
		$file_upload.parentNode.hidden = true
		file_upload_form.elem.hidden = true
		cleanup()
	},
	
	cleanup() {
		selected_file = null
		$file_image.src = ""
	},
	
	got_file(file) {
		$file_cancel.parentNode.hidden = false
		$file_upload.parentNode.hidden = false
		file_upload_form.elem.hidden = false
		$file_browse.hidden = true
		$file_url.hidden = true
		$file_done.parentNode.hidden = true
		
		$file_image.src = ""
		$file_image.src = URL.createObjectURL(file)
		file_upload_form.set_some({
			size: (file.size/1000)+" kB",
			name: file.name,
		})
		selected_file = file
		select_tab(3) //hack HACK
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
		//var x = scroller.scrollBottom
		while (message_count > 500) {
			let n = scroller.inner.firstChild
			let id = n.dataset.id
			if (id)
				delete displayed_ids[+id]
			n.remove()
			message_count--
		}
		//scroller.scrollBottom = x
	}
	
})<!-- PRIVATE })

0<!-- Sidebar ({
})(window)
Object.seal(Sidebar)

window.print = Sidebar.print
