let Debug = ((u=NAMESPACE({
	printing: false,
	output: null,
	message_count: 0,
	
	onload() {
		u.output = $debugOutput
		$debugInput.onkeydown = e=>{
			if (e.isComposing)
				return
			if (e.keyCode==13 && !e.shiftKey) {
				e.preventDefault()
				let code = $debugInput.value
				if (!code) return
				u.eval(code)
				$debugInput.select()
				document.execCommand('delete')
			}
		}
	},
	
	eval(code) {
		u.output.prepend(document.createElement('hr'))
		log(">"+code)
		let res = eval(code)
		log(res)
	},
	
	log(...args) {
		do_when_ready(()=>{
			if (u.printing) {
				alert("recursive print detected!")
				return
			}
			u.printing = true
			for (let arg of args) {
				let elem
				try {
					elem = Draw.sidebar_debug(arg)
				} catch (e) {
					elem = "error printing!"
					alert("error while printing!"+e)
					console.error(e)
				}
				u.output.prepend(elem)
				u.message_count++
			}
			u.printing = false
		})
	},
}))=>u)()

let log = Debug.log

do_when_ready(Debug.onload)
