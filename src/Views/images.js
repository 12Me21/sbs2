// oh I just realized...
// the function($){...}(window) trick won't work here
// because View has been initialized, so it COULD have a property named `window`...
<!--/* trick indenter
with (View) (function($) { "use strict" //*/

// todo:
// - page selector input type
// - add a page for viewing info about a specific image (image/id? or images/id?), or otherwise some way to find a specific image by id here

addView('images', {
	init() {
		let nav = $fileNav
		$fileSearchBucket.onchange = ()=>{
			currentQuery.bucket = $fileSearchBucket.value || undefined
			Nav.go("images"+Req.queryString(currentQuery))
		}
		navButtons = Draw.navButtons()
		nav.append(navButtons.element)
		navButtons.onchange = (n)=>{
			currentQuery.page = n
			Nav.go("images"+Req.queryString(currentQuery))
		}
		
		$setAvatarButton.onclick = ()=>{
			if (!selectedFile)
				return
			Req.setBasic({avatar: selectedFile.id}, (user)=>{
				if (user) {
					// have to do this because rannnnnnnnnnndommmmmmm broke user activityyy
					updateMyUser(user)
				}
			})
		}
		$fileUpdateButton.onclick = ()=>{
			if (!selectedFile)
				return
			readFields(selectedFile)
			Req.putFile(selectedFile, (e, resp)=>{
				if (!e) {
					resp.createUser = selectedFile.createUser //ehhhhh
					selectFile(resp)
				}
				//eh
			})
		}
	},
	start(id, query, render) {
		currentQuery = query
		let page = +query.page || 1
		navButtons.set(page)
		
		let search = {
			limit: 20,
			skip: (page-1)*20,
			reverse: true,
		}
		query.bucket && (search.bucket = query.bucket)
		return Req.read([
			{file: search},
			"user.0createUserId"
		], {}, (e, resp)=>{
			if (!e)
				render(resp.file)
			else
				render(null)
		}, false) //mm
	},
	className: 'fileMode',
	render(files) {
		setTitle("Files")
		fileList = files
		files.forEach((file)=>{
			$fileBox.append(Draw.fileThumbnail(file, selectFile))
		})
	},
	cleanUp() {
		$fileBox.replaceChildren()
		selectFile(null)
		fileList = null
	},
})

var fileList

function readFields(data) {
	data.permissions = JSON.safeParse($filePermissions.value)
	data.values = JSON.safeParse($fileValues.value)
	data.name = $fileName.value
	data.bucket = $fileBucket.value
}

function selectFile(file) {
	if (!file) {
		selectedFile = file
		flag('fileSelected', false)
		$filePageView.src = ""
		return
	}
	selectedFile = file
	$fileName.value = file.name
	$filePermissions.value = JSON.stringify(file.permissions)
	$fileValues.value = JSON.stringify(file.values)
	$fileUser.replaceChildren(Draw.entityTitleLink(file.createUser))
	$filePageView.src = ""
	$filePageView.src = Req.fileURL(file.id)
	//Draw.setBgImage($filePageView, Req.fileURL(file.id))
	flag('fileSelected', true)
	flag('canEdit', /u/.test(file.myPerms))
}

var selectedFile
var navButtons
var currentQuery

<!--/*
}(window)) //*/
