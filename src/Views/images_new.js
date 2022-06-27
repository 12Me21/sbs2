'use strict'

const IMAGES_VIEW_PAGINATION = 20
const IMAGES_VIEW_SIZE = 64

View.add_view('images', {
	form: null,
	current: null,
	Init() {
		$imagesWhatever.innerHTML = ''
		$imagesAvatarButton.addEventListener('click', this.add_avatar)
		// todo (for 12): saw something about making nav buttons? im just doing
		// a custom thing here for now until you decide to do something about
		// it ig, ill even scope it just for you </3
		{
			
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
	Render({ content=[] }, { page }) {
		View.set_title(" Images ")
		content.forEach(x => {
			const img = document.createElement('img')
			img.src = Req.file_url(x.hash, `size=${IMAGES_VIEW_SIZE}`)
			img.addEventListener('click', y => this.current = x)
			$imagesWhatever.append(img)
		})
		
		$imagesNavPage.textContent = String(page)

		// fixme: this is shit.
		$imagesNavBack.onClick = () => {
			console.log("hewwo?")
			window.location.replace(`#images?page=${page-1}`)
		}
		$imagesNavForward.onClick = () => {
			window.location.replace(`#images?page=${page+1}`)
		}
	},
	Cleanup(type) {
		$imagesWhatever.innerHTML = ''
		$imagesAvatarButton.removeEventListener('click', this.add_avatar)
		this.current = null
	},
	set current(content) {
		if (content === null) {
			$imagesCurrentImg.src = ''
			return
		}
		$imagesCurrentImg.src = Req.file_url(content.hash)
		const formData = {
			filename: content.name,
			bucket: content.values?.bucket,
			// fixme: what is this for exactly?
			values: content.values,
			// fixme: idr how to get permissions lol im dumb
			permissions: null
		}
		this.form?.set(formData)
		this.form?.write(formData)
	},
	set_avatar() {
		if (current === null) return
		Req.me.avatar = this.current.hash
		Req.write(Req.me).do = (resp, err)=>{
			if (!err)
				print('ok')
			else
				alert('edit failed')
		}
	},
})
