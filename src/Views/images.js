// todo:
// - page selector input type
// - add a page for viewing info about a specific image (image/id? or images/id?), or otherwise some way to find a specific image by id here
View.add_view('images', {
	form: null,
	selectedFile: null,
	navButtons: null,
	currentQuery: null,
	fileList: null,
	
	init() {
		let nav = $fileNav
		$fileSearchBucket.onchange = ()=>{
			this.currentQuery.bucket = $fileSearchBucket.value || undefined
			Nav.go("images"+Req.query_string(this.currentQuery))
		}
		this.navButtons = Draw.nav_buttons()
		nav.append(this.navButtons.element)
		this.navButtons.onchange = (n)=>{
			this.currentQuery.page = n
			Nav.go("images"+Req.query_string(this.currentQuery))
		}
		
		$setAvatarButton.onclick = ()=>{
			if (!this.selectedFile)
				return
			Req.set_basic({avatar: this.selectedFile.id}).then((user)=>{
				View.update_my_user(user) // have to do this because rannnnnnnnnnndommmmmmm broke user activityyy
			})
		}
		$fileUpdateButton.onclick = ()=>{
			if (!this.selectedFile)
				return
			this.readFields(this.selectedFile)
			Req.put_file(this.selectedFile).then((resp)=>{
				resp.createUser = this.selectedFile.createUser //ehhhhh
				this.selectFile(resp)
			})
		}
		
		this.form = new Form({
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
		$imageForm.fill(this.form.elem)
	},
	start(id, query) {
		this.currentQuery = query
		let page = +query.page || 1
		
		let search = {
			limit: 20,
			skip: (page-1)*20,
			reverse: true,
		}
		query.bucket && (search.bucket = query.bucket) // did i really write this like that lol
		return {
			chains: [
				['file', search],
				['user.0createUserId'],
			],
			fields: {},
			ext: {page, query},
		}
	},
	render(resp, {page, query}) {
		$fileSearchBucket.value = query.bucket || ""
		this.navButtons.set(page)
		let files = resp.file
		View.set_title("Files")
		this.fileList = files
		$fileBox.fill(files.map(file => Draw.file_thumbnail(file, this.selectFile.bind(this))))
	},
	cleanup() {
		$fileBox.fill()
		this.selectFile(null)
		this.fileList = null
	},
	// extra
	readFields(file) {
		let data = this.form.get()
		file.name = data.filename
		file.bucket = data.bucket
		file.values = JSON.safe_parse(data.values)
		file.permissions = JSON.safe_parse(data.permissions)
	},
	
	selectFile(file) {
		$filePageView.src = "" // set to "" to hide old image immediately
		if (!file) {
			this.selectedFile = file
			View.flag('fileSelected', false)
			return
		}
		this.selectedFile = file
		this.form.set({
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
		View.flag('fileSelected', true)
		View.flag('canEdit', /u/.test(file.myPerms))
	},	
	
})


