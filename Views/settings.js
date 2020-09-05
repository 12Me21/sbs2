<!--/* trick indenter
with (View) (function($) { "use strict" //*/

addView('settings', {
	className: 'settingsMode',
	render: function() {
		setTitle("Account Settings")
	},
	init: function() {
		$loginForm.login.onclick = function(e) {
			e.preventDefault()
			Req.authenticate($loginForm.username.value, $loginForm.password.value, function(e, resp) {
			})
		}
		$logOut.onclick = function(e) {
			Req.logOut()
		}

		$registerForm.$registerButton.onclick = function(e) {
			e.preventDefault()
			registerError("Registering...")
			var data = readRegisterFields()
			if (data.error) {
				registerError(data.error)
				return
			}
			Req.register(data.username, data.password, data.email, function(e, resp) {
				console.log(resp)
				if (!e) {
					sendConfirmationEmail()
				} else {
					if (e == 'error' && resp) {
						registerError(resp.errors, "Registration failed:")
					} else if (e == 'rate') {
						registerError("slow down!")
					} else {
						registerError("unknown error")
					}
				}
			})
		}
		$resendEmail.onclick = function(e) {
			e.preventDefault()
			sendConfirmationEmail()
		}
		$registerConfirm.onclick = function(e) {
			e.preventDefault()
			registerError("Confirming...")
			// todo: validate the key client-side maybe
			Req.confirmRegister($emailCode.value, function(e, resp) {
				if (!e) {
					registerError("Registration Complete")
					// todo: something here
				} else {
					registerError(resp, "Confirmation failed:")
				}
			})
		}
	}
})

function registerError(message, title) {
	var text = ""
	if (message == undefined)
		text = ""
	else if (message instanceof Array)
		text = message.join("\n")
	else if (typeof message == 'string') {
		text = message
	} else {
		//todo: this tells us which fields are invalid
		// so we can use this to highlight them in red or whatever
		for (var key in message) {
			text += key+": "+message[key]+"\n"
		}
	}
	if (title)
		text = title+"\n"+text
	$registerError.textContent = text
}

function readRegisterFields() {
	var data = {
		username: $registerForm.username.value,
		password: $registerForm.password.value,
		email: $registerForm.email.value,
	}
	data.error = {}
	if (data.password.length < 8)
		data.error.password = "Password too short"
	if (data.username.length < 2)
		data.error.username = "Username too short"
	if (data.username.length > 20)
		data.error.username = "Username too long"
	if (data.password != $registerForm.password2.value)
		data.error.password2 = "Passwords don't match"
	if (data.email != $registerForm.email2.value)
		data.error.email2 = "Emails don't match"
	if (!Object.keys(data.error).length)
		data.error = null
	return data
}

function sendConfirmationEmail() {
	var email = $registerForm.email.value
	if (!email) {
		registerError({email: "No email"})
	} else {
		registerError("Sending email...")
		Req.sendEmail(email, function(e, resp){
			if (!e) {
				registerError("Confirmation email sent")
			} else if (e == 'error') {
				registerError({email: resp}, "Failed to send confirmation email:")
			} else if (e == 'rate') {
				registerError("Slow down!")
			} else {
				registerError("unknown error")
			}
		})
	}
}

<!--/*
}(window)) //*/ // pass external values
