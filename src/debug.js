let Debug = ((u=NAMESPACE({
	printing: false,
	
	onload() {
		$debugInput.onkeydown = e=>{
			if (e.isComposing)
				return
			if ('Enter'==e.key && !e.shiftKey) {
				e.preventDefault()
				let code = $debugInput.value
				if (!code) return
				u.eval(code)
				// todo: option to not clear (or button to retrieve previous entry?) for devices without undo
				// also it's kinda nicer when your code persists tbh?
				Edit.clear($debugInput)
			}
		}
	},
	
	eval(code) {
		print(">"+code)
		try {
			let res = eval(code)
			print(res)
		} catch(e) {
			print(e)
		}
	},
	
	format_error: function(thing) {
		let s = this()
		let out = ""
		let pf = null
		for (let line of thing.stack.split("\n")) {
			if (line=="") continue
			let at = line.split("@")
			if (at.length == 2) {
				let file = at[1].replace(BASE_URL, "")
				let star = at[0].split("*")
				if (star.length==2) {
					at[0] = star[1]
				}
				let func = pf
				pf = at[0]
				if (func!=null)
					line = "↓"+func+"() - "+file //🙚❧🙘 //🙯⸽🙘
				else
					line = "💥 - "+file
				if (star.length==2) {
					out = ":<async "+star[0]+">\n"+out
				}
				out = line+"\n"+out
			} else {
				out = ":(\n"+thing.stack
				break
			}
		}
		s.textContent = out
		return s
	}.bind(𐀶`<pre>`),
	
	//📥 thing‹???›
	//📤 ‹ParentNode›
	sidebar_debug: function(thing) {
		let e = this.message()
		switch (thing===null ? 'null' : typeof thing) {
		case 'boolean': case 'number': case 'bigint':
		case 'undefined': case 'null': case 'symbol':
			thing = String(thing)
			// FALLTHROUGH
		case 'string': {
			e.append(thing)
		} break; case 'function': {
			let src = Function.prototype.toString.call(thing)
			e.append(src)
		} break; case 'object': {
			if (thing instanceof Error) {
				let s = Debug.format_error(thing)
				e.append(s)
				e.append(thing.toString())
				break
			}
			if (thing instanceof Element) {
				let text = "<"+thing.tagName
				// technically this could fail if e.g. a class inherits from Element and overrides .attributes to do something weird..
				for (let x of thing.attributes) {
					text += ` ${x.name}="${x.value.replace(/&/g,"&amp;").replace(/"/g,"&quot;")}"`
				}
				text += ">"
				if (thing.childElementCount)
					text += `\n(${thing.childElementCount} childs)`
				e.append(text)
				break
			}
			let text = "{???}"
			let pro = Object.getPrototypeOf(thing)
			if (pro === Object.prototype) {
				text = "{...}"
			} else if (pro === null) {
				text = "{null}"
			} else if (pro && pro.constructor) {
				let c = pro.constructor
				if (c && c.name && 'string'==typeof c.name)
					text = `{new ${c.name}}`
			}
			e.append(text)
		} }
		return e
	}.bind({message:𐀶`<div class='debugMessage pre'>`}),
	
}))=>u)()

do_when_ready(Debug.onload)
