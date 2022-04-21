let Settings = Object.create(null)
with(Settings)((window)=>{"use strict"; Object.assign(Settings,{
	values: {},
	
	/*fields: [
		['theme', 'select', {label: "Theme", default: 'auto', onchange: value=>{
			if (value == 'auto')
				delete document.documentElement.dataset.theme
			else
				document.documentElement.dataset.theme = value
		}}, {
			options: [['auto',"auto"],['light',"light"],['dark',"dark"]],
		}],
		['nickname', 'text', {label: "Chat Nickname"}],
		['chat_markup', 'select', {label: "Chat Markup Language"}, {
			options: [['12y',"12y"],['bbcode',"bbcode"]],
		}],
		['scroller_anim_type', 'select', {label: "Scroll Animation Method", default: "1", onchange: value=>{
			Scroller.anim_type = +value
		}}, {
			options: [['1',"requestAnimationFrame"],['2',"Animation"],['0',"disabled"]],
		}],
		['big_avatar', 'checkbox', {label: "Big Avatar"}],
		['big_avatar_id', 'text', {label: "Big Avatar Id"}],
		['sitejs', 'textarea', {label: "Custom Javascript", save_button=true, onchange: value=>{
			try {
				eval(value)
			} catch (e) {
				console.error("failed to run sitejs", e)
				print(e.stack)
				print("error in sitejs ^")
			}
		}}],
		['sitecss', 'textarea', {label: "Custom CSS", save_button=true, onchange: value=>{
			do_when_ready(()=>{
				$customCSS.textContent = value
			})
		}}],
		],
for this to work,, we need:
- a safe way to set the value of a field (i.e. check types) for when loading 
- system for saving/loading localstorage
- onchange event
- onchange when [save] button is clicked
*/
	
	fields: {
		theme: {
			name: "Theme",
			type: 'select',
			options: ['auto','light','dark'],
			// change event can run any time (even before DOM ready)
			update(value) {
				if (value != 'auto')
					window.document.documentElement.dataset.theme = value
				else
					delete window.document.documentElement.dataset.theme
			},
		},
		nickname: {
			name: "Chat Nickname",
			type: 'text',
		},
		chat_markup: {
			name: "Chat Markup Language",
			type: 'select',
			options: ['12y','bbcode','html'],
		},
		scroller_anim_type: {
			name: "scroll animation method",
			type: 'select',
			options: ['2', '1', '0'],
			update(value) {
				Scroller.anim_type = +value
			},
		},
		big_avatar: {
			name: "Big Avatar",
			type: 'select',
			options: ['off', 'on'],
		},
		big_avatar_id: {
			name: "Big Avatar Id",
			type: 'text',
		},
		sitejs: {
			name: "Custom Javascript",
			type: 'textarea',
			autosave: false,
			//todo: maybe highlight when changed, to notify user that they need to save manually?
			update(value) {
				try {
					eval(value)
				} catch (e) {
					console.error("failed to run sitejs", e)
					print(e.stack)
					print("error in sitejs ^")
				}
			},
		},
		sitecss: {
			name: "Custom CSS",
			type: 'textarea',
			autosave: false,
			update(value) {
				do_when_ready(()=>{
					$customCSS.textContent = value
				})
			},
		},
	},
	
	early() {
		Object.for(fields, (field, name)=>{
			let value = Store.get("setting-"+name)
			if (value != null)
				value = JSON.safe_parse(value)
			else
				value = undefined
			if (value === undefined) {
				if (field.options)
					value = field.options[0]
				else
					value = ""
			}
			values[name] = value
			if (field.update)
				field.update(value)
		})
	},
	
	// change a setting after load
	change(name, value) {
		let field = fields[name]
		if (!field) return
		values[name] = value
		Store.set("setting-"+name, JSON.stringify(value))
		field.update && field.update(value)
	}
	
})<!-- PRIVATE })	


0<!-- Settings ({
})(window)
Object.seal(Settings)
