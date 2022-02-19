let Sidebar = Object.create(null)
with(Sidebar)((window)=>{"use strict";Object.assign(Sidebar,{
	
	selectedFile: null,
	
	scroller: null,
	prePrint: [],
	
	sidebarPanels: null,
	
	selectTab: null,
	
	intervalId: null,
	
	myAvatar: null,
	
	file_upload_form: null,
	
	refresh_time_interval(data) { //unused parameter
		if (intervalId)
			window.clearInterval(intervalId)
		intervalId = window.setInterval(()=>{
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
		$fileUploadForm.replaceChildren(file_upload_form.elem)
		$openSidebar.onclick = $closeSidebar.onclick = toggle
		View.attachResize($sidebar, $sidebarResize, true, -1, "sidebarWidth")
		View.attachResize($sidebarTop, $sidebarResize, false, 1, "sidebarPinnedHeight")
		View.flag('sidebar', true)
		View.attachPaste((file)=>{ fileUploaded(file) })
		$imageUpload.onchange = function(e) { // must not be arrow func
			let file = this.files[0]
			try {
				file && fileUploaded(file)
			} finally {
				this.value = ""
			}
		}
		$fileCancel.onclick = $fileDone.onclick = fileCancel
		$fileUpload.onclick = function() {
			if (selectedFile) {
				$fileUpload.disabled = true
				
				let data = file_upload_form.get()
				selectedFile.bucket = data.bucket
				if (data.quantize)
					selectedFile.quantize = +data.quantize
				selectedFile.filename = data.name
				Req.uploadFile(selectedFile, (e, file)=>{
					$fileUpload.disabled = false
					if (e) // failed
						return
					View.flag('sidebarUploaded', true)
					$fileURL.value = Req.fileURL(file.id)
					$fileView.src = ""
					$fileView.src = Req.fileURL(file.id)
				})
			}
		}
		$fileURL.onclick = function() { $fileURL.select() }
		scroller = new Scroller($sidebarScroller.parentNode, $sidebarScroller)
		prePrint.forEach((x)=> print(x) )
		prePrint = null
		// todo: maybe a global ESC handler?
		/*document.addEventListener('keydown', function(e) {
		  
		  })*/
		let x = document.createDocumentFragment()
		let y = x.createChild('span')
		myAvatar = x.createChild('span')
		myAvatar.className += " loggedIn fill"
		y.className += " loggedOut"
		y.textContent = "log in"
		let sidebarTabs = Draw.sidebar_tabs([
			{label: document.createTextNode("✨"), elem: $sidebarActivityPanel},
			{label: document.createTextNode("W"), elem: $sidebarWatchPanel},
			{label: document.createTextNode("🔍"), elem: $sidebarNavPanel},
			{label: document.createTextNode("📷"), elem: $sidebarFilePanel},
			{label: x, elem: $sidebarUserPanel},
		])
		$sidebarTabs.replaceChildren(sidebarTabs.elem)
		sidebarTabs.select(0)
		selectTab = sidebarTabs.select
		
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
	
	// this needs to be optimized
	// it redraws the entire list of pages in activity + watching, EVERY time they update
	onAggregateChange(aggregate) {
		let items = []
		Object.for(aggregate, (a)=>{
			if (a.content) //HACK
				items.push(a)
		})
		items.sort((a, b)=> -(a.lastDate - b.lastDate))
		$sidebarActivity.replaceChildren()
		$sidebarWatch.replaceChildren()
		items.forEach((item)=>{
			$sidebarActivity.append(Draw.activity_item(item))
			if (item.watching)
				$sidebarWatch.append(Draw.activity_item(item))
		})
		refresh_time_interval(aggregate)
	},
	
	redrawCategoryTree(cats) {
		$sidebarCategories.replaceChildren(Draw.nav_category(cats[0]))
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
			scroller.handlePrint(()=>{
				displayedMessages++
				limitMessages()
				return Draw.sidebar_debug(text)
			}, true)
		else
			prePrint.push(text)
	},
	
	fileCancel() {
		selectedFile = null
		View.flag('sidebarFile', false)
		View.flag('sidebarUploaded', false)
		cleanUp()
	},
	
	cleanUp() {
		selectedFile = null
		$fileView.src = ""
	},
	
	fileUploaded(file) {
		View.flag('sidebarUploaded', false)
		View.flag('sidebarFile', true)
		$fileView.src = ""
		$fileView.src = URL.createObjectURL(file)
		file_upload_form.set_some({
			size: (file.size/1000)+" kB",
			name: file.name,
		})
		selectedFile = file
		selectTab(3) //hack HACK
	},
	
	toggle() {
		let fullscreen = isFullscreen()
		if (fullscreen) {
			View.flag('mobileSidebar', !View.flags.mobileSidebar)
		} else {
			View.flag('sidebar', !View.flags.sidebar)
			Store.set('sbs-sidebar', !!View.flags.sidebar)
		}
	},
	
	isFullscreen() {
		return !window.matchMedia || window.matchMedia("(max-width: 700px)").matches
	},
	
	displayedMessages: 0,
	
	displayedIds: {},
	
	displayMessages(comments, initial) {
		scroller.handlePrint(()=>{
			comments.forEach((c)=>{
				if (c.deleted) {
					let del = displayedIds[c.id]
					if (del) {
						del.remove()
						delete displayedIds[c.id]
						displayedMessages--
					}
				} else {
					let old = displayedIds[c.id]
					let nw = Draw.sidebar_comment(c)
					if (old) {
						old.replaceWith(nw)
					} else {
						scroller.inner.append(nw)
						displayedMessages++
					}
					displayedIds[c.id] = nw
					limitMessages()
				}
			})
		}, !initial)
		if (initial)
			scroller.scrollInstant()
	},
	
limitMessages() {
	//var x = scroller.scrollBottom
	while (displayedMessages > 500) {
		let n = scroller.inner.firstChild
		let id = n.dataset.id
		if (id)
			delete displayedIds[+id]
		n.remove()
		displayedMessages--
	}
	//scroller.scrollBottom = x
}

})<!-- PRIVATE })

0<!-- Sidebar ({
})(window)

window.print = Sidebar.print
