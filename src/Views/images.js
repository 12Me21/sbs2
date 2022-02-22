// oh I just realized...
// the function($){...}(window) trick won't work here
// because View has been initialized, so it COULD have a property named `window`...
with (View) (()=>{ "use strict"; {
	let form = null
	let selectedFile = null
	let navButtons
	let currentQuery
	
	// todo:
	// - page selector input type
	// - add a page for viewing info about a specific image (image/id? or images/id?), or otherwise some way to find a specific image by id here
	add_view('images', {
		init() {
			let nav = $fileNav
			$fileSearchBucket.onchange = ()=>{
				currentQuery.bucket = $fileSearchBucket.value || undefined
				Nav.go("images"+Req.query_string(currentQuery))
			}
			navButtons = Draw.nav_buttons()
			nav.append(navButtons.element)
			navButtons.onchange = (n)=>{
				currentQuery.page = n
				Nav.go("images"+Req.query_string(currentQuery))
			}
			
			$setAvatarButton.onclick = ()=>{
				if (!selectedFile)
					return
				Req.set_basic({avatar: selectedFile.id}, (user)=>{
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
					['user', 'user_output', {output: true, label: "User"}],
					['filename', 'text', {label: "File Name"}],
					['bucket', 'text', {label: "Bucket"}],
					['values', 'text', {label: "Values"}], // todo: add an input type for like, json or specifically these values types idk
					['permissions', 'text', {label: "Permissions"}], //could be a real permission editor but image permissions don't really work anyway
					//['size', 'output', {output: true, label: "Size"}], I wish
					['quantization', 'output', {output: true, label: "Quantization"}],
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
		className: 'images',
		render(files) {
			setTitle("Files")
			fileList = files
			$fileBox.replaceChildren(
				...files.map(file => Draw.file_thumbnail(file, selectFile)))
		},
		cleanUp() {
			$fileBox.replaceChildren()
			selectFile(null)
			fileList = null
		},
	})
	
	let fileList
	
	function readFields(file) {
		let data = form.get()
		file.name = data.filename
		file.bucket = data.bucket
		file.values = JSON.safeParse(data.values)
		file.permissions = JSON.safeParse(data.permissions)
	}
	
	function selectFile(file) {
		$filePageView.src = "" // set to "" to hide old image immediately
		if (!file) {
			selectedFile = file
			flag('fileSelected', false)
			return
		}
		selectedFile = file
		form.set({
			user: file.createUser,
			filename: file.name,
			bucket: file.bucket,
			values: JSON.stringify(file.values),
			permissions: JSON.stringify(file.permissions),
			quantization: file.quantization,
		})
		let url = Req.file_url(file.id)
		$fileDownload.href = url
		$fileDownload.download = file.name
		
		$filePageView.src = url
		//Draw.setBgImage($filePageView, Req.file_url(file.id))
		flag('fileSelected', true)
		flag('canEdit', /u/.test(file.myPerms))
	}
}})()
