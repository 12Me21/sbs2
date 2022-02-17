// oh I just realized...
// the function($){...}(window) trick won't work here
// because View has been initialized, so it COULD have a property named `window`...
with (View) (()=>{ "use strict"; {
	let form = null
	
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
			navButtons = Draw.nav_buttons()
			nav.append(navButtons.element)
			navButtons.onchange = (n)=>{
				currentQuery.page = n
				Nav.go("images"+Req.queryString(currentQuery))
			}
			
			$setAvatarButton.onclick = ()=>{
				if (!selectedFile)
					return
				Req.setBasic({avatar: selectedFile.id}, (user)=>{
					user && updateMyUser(user) // have to do this because rannnnnnnnnnndommmmmmm broke user activityyy
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
			
			form = new Form({
				fields: [
					//{name: 'user', type: 'user', output: {label: "User"}},
					{name: 'filename', type: 'text', label: "File Name", input: {}},
					{name: 'bucket', type: 'text', label: "Bucket", input: {}},
					{name: 'values', type: 'text', label: "Values", input: {}}, // todo: add an input type for like, json or specifically these values types idk
					{name: 'permissions', type: 'text', label: "Permissions", input: {}}, // this could be a real permission editor but image permissions don't really work anyway
				]
			})
			$imageForm.replaceChildren(form.elem)
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
				['file', search],
				['user.0createUserId'],
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
				$fileBox.append(Draw.file_thumbnail(file, selectFile))
			})
		},
		cleanUp() {
			$fileBox.replaceChildren()
			selectFile(null)
			fileList = null
		},
	})
	
	var fileList
	
	function readFields(file) {
		let data = form.get()
		file.name = data.filename
		file.bucket = data.bucket
		file.values = JSON.safeParse(data.values)
		file.permissions = JSON.safeParse(data.permissions)
	}
	
	function selectFile(file) {
		if (!file) {
			selectedFile = file
			flag('fileSelected', false)
			$filePageView.src = ""
			return
		}
		selectedFile = file
		console.log(file.bucket)
		form.set({
			filename: file.name,
			bucket: file.bucket,
			values: JSON.stringify(file.values),
			permissions: JSON.stringify(file.permissions),
		})
		//$fileUser.replaceChildren(Draw.entity_title_link(file.createUser))
		$filePageView.src = ""
		$filePageView.src = Req.fileURL(file.id)
		//Draw.setBgImage($filePageView, Req.fileURL(file.id))
		flag('fileSelected', true)
		flag('canEdit', /u/.test(file.myPerms))
	}
	
	
	var selectedFile
	var navButtons
	var currentQuery
	
}})()
