'use strict'

// this component goes inside an existing View, and allows selecting a message and sending message_control events of it.
// unfinished
// note that the parent is responsible for actually handling these events (e.g. going into edit mode when the edit button is clicked) and not all parents will support all event types.

class MessageInfo {
	constructor() {
		new.target.template(this)
		this.current = null // todo: allow selecting multiple and have a ui for this somehow (specifically for rethreading and linking to logs)
		this.control_buttons = {__proto__:null}
		// yeah
		let btn = (action, label)=>{
			let btn = document.createElement('button')
			btn.onclick = ev=>{ MessageList.send_mce(action, this.current, this.$root) }
			btn.dataset.action = action
			btn.tabIndex=-1
			btn.append(label)
			this.$controls.append(btn)
			this.control_buttons[action] = btn
		}
		btn('raw', "📠raw")
		btn('edit', "✏️edit")
		btn('reply', "⤴️reply")
		btn('link', "🔗link")
		this.$close.onclick = ev=>{ this.set_message(null) }
		
		this.set_message(null)
	}
	set_message(data) {
		if (data) {
			this.$data.value = JSON.stringify(data, null, 1)
		} else {
			this.$data.value = ""
		}
		this.$root.hidden = !data
		this.current = data
		this.$close.focus() // i guess
	}
}

MessageInfo.template = HTML`
<div $=root class='message-info'>
<button $=close>×</button>message info!
<textarea $=data></textarea>
<div $=controls></div>
</div>
`
