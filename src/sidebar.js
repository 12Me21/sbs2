let Sidebar = Object.create(null)
with (Sidebar) (function($) { "use strict"; Object.assign(Sidebar, { 
	selectedFile: null,
	
	scroller: null,
	prePrint: [],
	
	sidebarPanels: null,
	
	selectTab: null,
	
	intervalId: null,
	
	myAvatar: null,
	
	refreshInterval(data) {
		if (intervalId) {
			$.clearInterval(intervalId)
			intervalId = null
		}
		intervalId = $.setInterval(()=>{
			Draw.updateTimestamps($sidebarActivity)
		}, 1000*30)
	},
	
	onLoad() {
		$openSidebar.onclick = $closeSidebar.onclick = toggle
		View.attachResize($sidebar, $sidebarResize, true, -1, "sidebarWidth")
		View.attachResize($sidebarTop, $sidebarResize, false, 1, "sidebarPinnedHeight")
		View.flag('sidebar', true)
		View.attachPaste((file)=>{ fileUploaded(file) })
		$imageUpload.onchange = function(e) {
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
				if ($fileUploadBucket.value)
					selectedFile.bucket = $fileUploadBucket.value
				if ($fileQuantizeColors.value)
					selectedFile.quantize = $fileQuantizeColors.value
				if ($fileUploadName.value)
					selectedFile.filename = $fileUploadName.value
				Req.uploadFile(selectedFile, (file)=>{
					$fileUpload.disabled = false
					if (file) {
						// setting the filename takes a second request
						// not anymore!!
						// get rid of this and just use the query param!!
						if ($fileUploadName.value) {
							$fileUploadNameOut.textContent = "(setting metadata...)"
							file.name = $fileUploadName.value
							Req.putFile(file, (e, resp)=>{
								$fileUploadNameOut.textContent = resp.name
								// yea
							})
						} else {
							$fileUploadNameOut.textContent = ""
						}
						View.flag('sidebarUploaded', true)
						$fileView.src = ""
						$fileView.src = Req.fileURL(file.id)
						$fileURL.value = Req.fileURL(file.id)
					} else {
					}
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
		let sidebarTabs = Draw.sidebarTabs([
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
					let bar = Draw.pageBar(item)
					bar.className += " linkBar bar rem1-5"
					$searchResults.append(bar)
				})
				users.forEach((item)=>{
					let bar = Draw.entityTitleLink(item)
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
		for (let a in aggregate) {
			if (a.content) //HACK
				items.push(a)
		}
		items.sort((a, b)=> -(a.lastDate - b.lastDate))
		$sidebarActivity.replaceChildren()
		$sidebarWatch.replaceChildren()
		items.forEach((item)=>{
			$sidebarActivity.append(Draw.activityItem(item))
			if (item.watching)
				$sidebarWatch.append(Draw.activityItem(item))
		})
		refreshInterval(aggregate)
	},
	
	redrawCategoryTree(cats) {
		$sidebarCategories.replaceChildren(Draw.navCategory(cats[0]))
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
				return Draw.sidebarDebug(text)
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
		$fileUploadSize.value = ""
		$fileUploadName.value = ""
		// don't reset bucket name
	},
	
	fileUploaded(file) {
		View.flag('sidebarUploaded', false)
		View.flag('sidebarFile', true)
		$fileView.src = ""
		$fileView.src = URL.createObjectURL(file)
		$fileUploadSize.value = (file.size/1000)+" kB"
		$fileUploadName.value = file.name || ""
		$fileUploadBucket.value = file.bucket || ""
		selectedFile = file
		selectTab(3) //hack HACK
		//fillFileFields(file)
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
		return !$.matchMedia || $.matchMedia("(max-width: 700px)").matches
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
					let nw = Draw.sidebarComment(c)
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

<!--/* 
}) //*/

<!--/*
}(window)) //*/

window.print = Sidebar.print
