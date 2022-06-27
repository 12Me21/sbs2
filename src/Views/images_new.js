'use strict'

const IMAGES_VIEW_PAGINATION = 20
const IMAGES_VIEW_SIZE = 64

View.add_view('images', {
	form: null,
	current: null,
	page: null,
	location: null,
	Init() {
		$imagesWhatever.innerHTML = ''
		$imagesAvatarButton.onclick = () => {
			if (!this.current) return
			Req.me.avatar = this.current.hash
			Req.write(Req.me).do = (resp, err)=>{
				if (!err)
					print('ok')
				else
					alert('edit failed')
			}
		}
		// FIXME: im pretty sure this is something that 12 wanted to be handled
		// by Draw?
		// FIXME: this is shit.
		$imagesNavBack.onclick = () => {
			if (this.page === undefined) return
			this.location.query.page = String(this.page-1)
			Nav.goto(this.location, true)
		}
		$imagesNavForward.onclick = () => {
			if (this.page === undefined) return
			this.location.query.page = String(this.page+1)
			Nav.goto(this.location, true)
		}
		this.form = new Form({
			fields: [
				// ['user', 'user_output', {label: "User"}],
				['filename', 'text', {label: "File Name"}],
				['bucket', 'text', {label: "Bucket"}],
				['values', 'text', {label: "Values"}], // todo: add an input type for like, json or specifically these values types idk
				['permissions', 'text', {label: "Permissions"}], //could be a real permission editor but image permissions don't really work anyway
				//['size', 'output', {output: true, label: "Size"}], I wish
				// ['quantization', 'output', {label: "Quantization"}],
			]
		})
		$imagesForm.fill(this.form.elem)
	},
	Start({id, query}) {
		const { page=0, bucket=null } = query;
		// TODO: bucket search
		return {
			chain: {
				values: {
					contentType: 3,
				},
				requests: [
					{
						type:'content',
						fields:'*',
						query: 'contentType = @contentType',
						order: 'id_desc',
						limit: IMAGES_VIEW_PAGINATION,
						skip: page * IMAGES_VIEW_PAGINATION,
					},
					// todo: maybe also get users?
					// {
					// 	type:'content',
					// 	fields:'*',
					// 	query: 'contentType = @contentType',
					// 	order: 'id_desc',
					// 	limit: IMAGES_PAGINATION,
					// 	skip: page * IMAGES_PAGINATION,
					// }
				],
			},
			ext: {
				page
			}
		}
	},
	Render({ content=[] }, { page }, location) {
		this.location = location
		this.page = parseInt(page)
		View.set_title(" Images ")
		content.forEach(x => {
			const img = document.createElement('img')
			img.src = Req.file_url(x.hash, `size=${IMAGES_VIEW_SIZE}`)
			img.addEventListener('click', y => this.current = x)
			$imagesWhatever.append(img)
		})
		
		$imagesNavPage.textContent = String(page)
	},
	Cleanup(type) {
		$imagesWhatever.innerHTML = ''
		this.current = null
		this.page = null
		this.location = null
	},
	set current(content) {
		if (content === null) {
			$imagesCurrentImg.src = ''
			$imagesCurrentLink.href = ''
			$imagesCurrentLink.textContent = ''
			return
		}
		$imagesCurrentImg.src = Req.file_url(content.hash)
		$imagesCurrentLink.href = `#file/${content.id}`
		$imagesCurrentLink.textContent = content.hash
		const formData = {
			filename: content.name,
			bucket: content.values?.bucket,
			// fixme: what is this for exactly?
			values: JSON.stringify(content.values),
			permissions: JSON.stringify(content.permissions)
		}
		this.form?.set(formData)
		this.form?.write(formData)
	},
})
