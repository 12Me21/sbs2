'use strict'

const IMAGES_VIEW_PAGINATION = 20
const IMAGES_VIEW_SIZE = 64

View.add_view('images', {
	form: null,
	current: null,
	page: null,
	location: null,
	user: null,
	Init() {
		$imagesWhatever.innerHTML = ''
		// FIXME: should put this in another function since it's also
		// done in the file view
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
			if (this.page === undefined || this.page <= 1) return
			this.location.query.page = String(this.page-1)
			Nav.goto(this.location, true)
		}
		$imagesNavForward.onclick = () => {
			if (this.page === undefined) return
			this.location.query.page = String(this.page+1)
			Nav.goto(this.location, true)
		}
		$imagesNavBucket.onblur = () => {
			this.location.query.bucket = $imagesNavBucket.value
			Nav.goto(this.location, true)
		}
		this.form = new Form({
			fields: [
				['user', 'user_output', {label: "User"}],
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
		const { page=1, bucket=null } = query;
		// TODO: bucket search
		return {
			chain: {
				values: {
					contentType: 3,
					key: 'bucket',
					bucket: `"${bucket}"`
				},
				requests: [
					{
						type:'content',
						fields:'*',
						query: `contentType = @contentType AND ${bucket ? '!valuelike(@key,@bucket)' : '!valuekeynotlike(@key)'}`,
						order: 'id_desc',
						limit: IMAGES_VIEW_PAGINATION,
						skip: (page-1) * IMAGES_VIEW_PAGINATION,
					},
					{
						type:'user',
						fields:'*',
						query: 'id in @content.createUserId.',
					}
				],
			},
			ext: {
				page,
				bucket
			}
		}
	},
	Render({ content=[], user=[] }, { page, bucket }, location) {
		this.location = location
		this.page = parseInt(page)
		this.user = user
		View.set_title(" Images ")
		content.forEach(x => {
			const img = document.createElement('img')
			img.src = Req.file_url(x.hash, `size=${IMAGES_VIEW_SIZE}`)
			img.addEventListener('click', y => this.current = x)
			$imagesWhatever.append(img)
		})
		
		$imagesNavPage.textContent = String(page)
		$imagesNavBucket.value = bucket
	},
	Cleanup(type) {
		$imagesWhatever.innerHTML = ''
		$imagesNavBucket.value = ''
		this.current = null
		this.page = null
		this.location = null
		this.form.reset()
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
			user: this.user?.find(u => u.id === content.createUserId),
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

