'use strict'

class AccountView extends BaseView {
	Start({id, query}) {
		return {quick: true}
	}
	Init() {
		this.$old_password.append(
			Draw.password_input("password")
		)
		this.$new_password.append(
			Draw.password_input("new_password", true)
		)
		this.$logout_all.onclick = ev=>{
			Req.request('User/invalidateall', null, null).do = (resp, err)=>{
				if (err) {
					alert("❌ invalidate failed\n"+err)
				} else {
					Nav.reload()
				}
			}
		}
		this.$form.onchange = ev=>{
			let e = ev.target
			if (e.hasAttribute('data-show-password')) {
				let p = e.parentNode.parentNode
				for (let pass of p.querySelectorAll('input[data-password]')) {
					pass.type = e.checked ? 'text' : 'password'
				}
			}
		}
		this.$form.onsubmit = ev=>{
			ev.preventDefault()
			let opw = ev.target.password.value
			let pw1 = ev.target.new_password1.value
			let pw2 = ev.target.new_password2.value
			if (pw1 !== pw2) {
				alert("❌ passwords don't match")
				ev.target.new_password1.value = ""
				ev.target.new_password2.value = ""
				return
			}
			console.log('passwording', opw, pw1)
			Req.request('User/privatedata', null, {
				currentPassword: opw,
				password: pw1,
			}).do = (resp, err)=>{
				if (err) {
					alert("❌ password change failed\n"+err)
				} else {
					Nav.reload()
				}
			}
		}
	}
	Quick() {
	}
	Destroy() {
	}
	password_visible(state) {
		let fields = this.$root.querySelectorAll('')
	}
}

AccountView.template = HTML`
<view-root>
	<button $=logout_all>Log out all sessions</button>
	<hr>
<h2>Change Password</h2>
	<form $=form method=dialog autocomplete=off>
		<label class='ROW' style='align-items:center;' $=old_password>
			current password:
		</label>
		<br>
		<label class='ROW' style='align-items:center;' $=new_password>
			new password:
		</label>
		<br>
		<button>Change Password</button>
	</form>
</view-root>
`

View.register('account', AccountView)
