//Carlos Sanchez - 2016
//randomouscrap98@aol.com
//-Yo, check it out. Drawing. In chat.

var LocalChatDraw = (function() {
	
	//The chatdraw canvas's expected width and height
	var chatDrawCanvasWidth = 200
	var chatDrawCanvasHeight = 100
	
	var drawAreaID = "chatdraw"
	var colorButtonClass = "colorChange"
	var colorPickerID = "colorPicker"
	var hideCharacters = 20
	var maxLineWidth = 7
	var maxScale = 5
	var defaultLineWidth = 2
	var drawer = false
	var animateFrames = false
	var animationPlayer = false
	var drawIframe
	var firstTimeRecentered = false
	
	var saveInput = false
	
	var animationTag = "_chdran"
	var allowAnimation = false
	
	var copyDrawing = function(string) {
		StorageUtilities.WriteLocal(ChatDrawUtilities.ClipboardKey, string)
		UXUtilities.Toast("Copied drawing (chatdraw only!)")
	}
	
	var getClipboardDrawing = function() {
		return StorageUtilities.ReadLocal(ChatDrawUtilities.ClipboardKey)
	}
	
	var checkMessageForDrawing = function(messageElement) {
		try {
			var content = messageElement.querySelector('[data-encoding="draw"]')
			
			if (content) {
				console.log("Converting drawing encoding to canvas image")
				
				var originalString = content.innerHTML
				var parts = originalString.split(")")
				var drawingString = ""
				var animationLink = false
				
				if (parts.length === 2) {
					drawingString = parts[1]
					animationLink = parts[0].slice(1)
				} else {
					drawingString = originalString
				}
				
				var canvas = ChatDrawUtilities.ChatDrawToFrame(drawingString).canvas
				content.innerHTML = ""
				content.appendChild(canvas)
				var date = new Date()
				var controlContainer = document.createElement("chatdraw-controlcontainer")
				
				if (allowAnimation && animationLink && animationLink.match("^https?://kland.smilebasicsource.com")) {
					var playButton = document.createElement("a")
					playButton.innerHTML = "►"
					playButton.className = "chatdrawplay"
					var animator = new AnimationPlayer(canvas, false)
					animator.OnPlay = function(player) {
						if (player.frames === false) {
							playButton.disabled = false
							playButton.innerHTML = "⌛"
							RequestUtilities.XHRSimple(animationLink, function(response) {
								animator.FromStorageObject(JSON.parse(response))
								animator.Play()
							})
							return false
						}
						
						playButton.disabled = false
						playButton.innerHTML = "◼"
					}
					animator.OnStop = function(player) {
						playButton.innerHTML = "►"
					}
					playButton.addEventListener("click", function() {
						if (animator.IsPlaying())
							animator.Stop()
						else {
							if (animator.GetRepeat())
								animator.Play(animator._currentFrame)
							else
								animator.Play()
						}
					})
					var copyAnimation = document.createElement("a")
					copyAnimation.innerHTML = "📋"
					copyAnimation.setAttribute("title", "Copy whole animation")
					copyAnimation.addEventListener("click", function() {
						UXUtilities.Confirm("Copying this animation will OVERWRITE " +
												  "your current animation. Make sure you save your work first! " +
												  "Are you sure you want to copy this animation?", function(confirmed) {
													  if (!confirmed) return
													  RequestUtilities.XHRSimple(animationLink, function(response) {
														  //Since we downloaded it anyway we might as well also
														  //load up the animator.
														  var storeObject = JSON.parse(response)
														  animator.FromStorageObject(storeObject)
														  loadAnimation(storeObject)
														  saveInput.value = ""
													  })
												  })
					})
					controlContainer.appendChild(copyAnimation)
					controlContainer.appendChild(playButton)
				} else {
					var downloadLink = document.createElement("a")
					downloadLink.href = canvas.toDataURL("image/png")
					downloadLink.download = "chatDraw_" + Date.now() + ".png"
					downloadLink.innerHTML = "💾"
					downloadLink.className = "chatdrawdownload"
					var copyLink = document.createElement("a")
					copyLink.innerHTML = "📋"
					copyLink.className = "chatdrawcopy"
					copyLink.addEventListener("click", function(ev) {
						copyDrawing(originalString)
					})
					if (allowAnimation) controlContainer.appendChild(copyLink)
					controlContainer.appendChild(downloadLink)
				}
				content.appendChild(controlContainer)
			}
		} catch(ex) {
			console.log("Error while converting drawing message to canvas: " + ex)
		}
	}
	
	var createToolButton = function(displayCharacters, toolNames) {
		if (!TypeUtilities.IsArray(displayCharacters)) displayCharacters= [displayCharacters]
		if (!TypeUtilities.IsArray(toolNames)) toolNames = [toolNames]
		var nextTool = 0
		var tButton = HTMLUtilities.CreateUnsubmittableButton(displayCharacters[nextTool])
		//makeUnsubmittableButton()
		//tButton.innerHTML = displayCharacters[nextTool]
		tButton.className = "toolButton"
		tButton.addEventListener('click', function() {
			//First, deselect ALL other buttons
			var toolButtons = document.querySelectorAll("#" + drawAreaID + " button.toolButton")
			for (var i = 0; i < toolButtons.length; i++) {
				if (toolButtons[i] != tButton) toolButtons[i].removeAttribute("data-selected")
			}
			
			//Now figure out if we're just selecting this button or cycling
			//through the available tools
			if (tButton.getAttribute("data-selected"))
				nextTool = (nextTool + 1) % toolNames.length
			
			tButton.innerHTML = displayCharacters[nextTool]
			tButton.setAttribute("data-selected", "true")
			drawer.currentTool = toolNames[nextTool]
		})
		return tButton
	}
	
	var setupInterface2 = function() {
		try {
			var messagePane = document.querySelector("#sendpane")
			
			var drawArea = document.createElement("draw-area")
			var buttonArea = document.createElement("button-area")
			drawIframe = document.createElement("iframe")
			var toggleButton = HTMLUtilities.CreateUnsubmittableButton() //makeUnsubmittableButton()
			var sendButton = HTMLUtilities.CreateUnsubmittableButton() //makeUnsubmittableButton()
			var positionButton = HTMLUtilities.CreateUnsubmittableButton() //makeUnsubmittableButton()
			
			//These are the only elements that will be displayed if the drawing area
			//goes hidden. CSS doesn't have to look at these, ofc.
			buttonArea.setAttribute("data-keep", "true")
			toggleButton.setAttribute("data-keep", "true")
			toggleButton.innerHTML = "✎"
			toggleButton.addEventListener("click", toggleInterface)
			sendButton.innerHTML = "➥"
			sendButton.addEventListener("click", sendDrawing2)
			positionButton.innerHTML = "◲"
			positionButton.className = "position"
			positionButton.addEventListener("click", function(e) {
				dockInterface(!drawArea.hasAttribute("data-docked"))
			})
			
			drawIframe.src = window.location.protocol + "//draw.smilebasicsource.com?nocache=1&nobg=1"
			drawArea.id = drawAreaID
			drawArea.setAttribute("data-fixedsize", "true")
			drawArea.setAttribute("data-scale", "2")
			drawArea.appendChild(drawIframe)
			buttonArea.appendChild(positionButton)
			buttonArea.appendChild(sendButton)
			buttonArea.appendChild(toggleButton)
			drawArea.appendChild(buttonArea)
			messagePane.appendChild(drawArea)
			
			//Make sure the interface is hidden, since we create it exposed.
			toggleInterface({target : toggleButton}, false)
			if (readStorage("chatDrawDocked")) dockInterface(true, drawArea)
			
			//Now set up the overall document events.
			document.querySelector("#sendpane textarea").addEventListener("keyup", onKeyUp)
			window.addEventListener("message", function(e) {
				if (e.data.type === "uploadImage") {
					if (e.data.link.indexOf("http://") === 0)
						sendMessage("/img " + e.data.link)
					else
						alert("Something went wrong: " + e.data.link)
				}
			})
		} catch(ex) {
			console.log("Error while setting up drawing interface: " + ex)
		}
	}
	
	var selectNextRadio = function() {
		var index = animateFrames.GetSelectedFrameIndex()
		if (index < animateFrames.GetFrameCount() - 1)
			animateFrames.SelectFrameIndex(index + 1)
	}
	
	var selectPreviousRadio = function() {
		var index = animateFrames.GetSelectedFrameIndex()
		if (index > 0)
			animateFrames.SelectFrameIndex(index - 1)
	}
	
	var getButtonColorString = function() {
		return getColorString(getButtonColors())
	}
	
	var getColorString = function(colors) {
		var colorSet = ""
		
		for (var i = 0; i < colors.length; i++) {
			colorSet += rgbToFillStyle(colors[i])
			if (i !== colors.length - 1)
				colorSet += "/"
		}
		
		return colorSet
	}
	
	var parseColorString = function(string) {
		var colors = string.split("/")
		var result = []
		
		for (var i = 0; i < colors.length; i++)
			result.push(fillStyleToRgb(colors[i]))
		
		return result
	}
	
	var setButtonColors = function(palette) {
		var buttons = getColorButtons()
		
		for (var i = 0; i < palette.length; i++) {
			if (i < buttons.length) {
				buttons[i].style.color = palette[i].ToRGBString() //colors[i]
				
				if (buttons[i].hasAttribute("data-selected"))
					drawer.color = buttons[i].style.color
			}
		}
		
		drawer.moveToolClearColor = rgbToFillStyle(getClearColor())
	}
	
	var widthToggle = function(widthButton) {
		var width = (Number(widthButton.dataset.width) % maxLineWidth) + 1
		widthButton.innerHTML = String(width)
		widthButton.setAttribute("data-width", String(width))
		drawer.lineWidth = width
	}
	
	var getAnimations = function(callback, element) {
		var formData = new FormData()
		formData.append("list", "1")
		fullGenericXHR("/query/submit/varstore?session=" + StorageUtilities.GetPHPSession(),
							formData, element, function(json, statusElement) {
								genericSuccess(json, element)
								
								var result = []
								
								for (var i = 0; i < json.result.length; i++)
									if (json.result[i].endsWith(animationTag))
										result.push(json.result[i].slice(0, -animationTag.length))
								
								callback(result)
							})
	}
	
	//Once you have a compliant v2 object, this is the actual load function.
	var loadAnimation = function(storeObject) {
		animationPlayer.FromStorageObject(storeObject)
		animateFrames.ClearAllFrames()
		
		for (var i = 0; i < animationPlayer.frames.length; i++) {
			animateFrames.InsertNewFrame(i - 1)
			animateFrames.SetFrame(animationPlayer.frames[i], i)
		}
		
		animateFrames.SelectFrameIndex(0)
	}
	
	var setupInterface = function(interfaceContainer, skipChatSetup) {
		var messagePane = interfaceContainer || document.querySelector("#sendpane")
		var i
		
		var drawArea = document.createElement("draw-area")
		var canvasContainer = document.createElement("canvas-container")
		var buttonArea = document.createElement("button-area")
		var buttonArea2 = document.createElement("button-area")
		var toggleButton = HTMLUtilities.CreateUnsubmittableButton() //makeUnsubmittableButton()
		var sendButton = HTMLUtilities.CreateUnsubmittableButton() // makeUnsubmittableButton()
		var widthButton = HTMLUtilities.CreateUnsubmittableButton() // makeUnsubmittableButton()
		var cSizeButton = HTMLUtilities.CreateUnsubmittableButton() // makeUnsubmittableButton()
		var undoButton = HTMLUtilities.CreateUnsubmittableButton() // makeUnsubmittableButton()
		var redoButton = HTMLUtilities.CreateUnsubmittableButton() // makeUnsubmittableButton()
		var clearButton = HTMLUtilities.CreateUnsubmittableButton() // makeUnsubmittableButton()
		var freehandButton = createToolButton(["✏","✒","⚟"], ["freehand","slow","spray"]) //["✏","✒"],
		var lineButton = createToolButton(["▬","◻"], ["line", "square"])
		var fillButton = createToolButton(["◘","◼"], ["fill","clear"])
		var moveButton = createToolButton(["↭"], ["mover"])
		var canvas = ChatDrawUtilities.CreateCanvas()
		var lightbox = ChatDrawUtilities.CreateCanvas()
		var colorPicker = document.createElement("input")
		lightbox.className = "lightbox"
		
		var frameContainer = document.createElement("animate-frames")
		animateFrames = new AnimatorFrameSet(frameContainer)
		animateFrames.OnFrameSelected = function(data) {
			setButtonColors(data.palette)
			drawer.buffers[0].canvas = data.canvas
			drawer.ClearUndoBuffer()
			drawer.Redraw()
			
			var lightboxFrames = []
			var lightboxCount = Number(lightboxButton.innerHTML)
			var selectedIndex = animateFrames.GetSelectedFrameIndex()
			var totalFrames = animateFrames.GetFrameCount()
			var i
			
			if (lightboxCount > 0) {
				for (i = Math.max(0, selectedIndex - lightboxCount); i < selectedIndex; i++)
					lightboxFrames.push(animateFrames.GetFrame(i))
			} else {
				for (i = Math.min(totalFrames - 1, selectedIndex - lightboxCount); i > selectedIndex; i--)
					lightboxFrames.push(animateFrames.GetFrame(i))
			}
			
			var opacities = [0.03, 0.12, 0.25]
			ChatDrawUtilities.CreateLightbox(lightboxFrames, lightbox, opacities.slice(-lightboxFrames.length))
		}
		
		var firstFrame = animateFrames.InsertNewFrame(0)
		
		drawer = new CanvasDrawer()
		drawer.Attach(canvas, [firstFrame.canvas], 5)
		drawer.OnUndoStateChange = function() {
			undoButton.disabled = !drawer.CanUndo()
			redoButton.disabled = !drawer.CanRedo()
		}
		
		//Set up the color picker
		colorPicker.id = colorPickerID
		colorPicker.setAttribute("type", "color")
		colorPicker.style.position = "absolute"
		colorPicker.style.left = "-10000px"
		colorPicker.style.top = "-10000px"
		colorPicker.style.width = "0"
		colorPicker.style.height = "0"
		colorPicker.addEventListener("change", function(event) {
			var frame = animateFrames.GetFrame() //GetSelectedFrame()
			var newColor = StyleUtilities.GetColor(event.target.value)
			CanvasUtilities.SwapColor(frame.canvas.getContext("2d"),
											  StyleUtilities.GetColor(event.target.associatedButton.style.color), newColor, 0)
			event.target.associatedButton.style.color = newColor.ToRGBString()
			drawer.color = newColor.ToRGBString()
			drawer.moveToolClearColor = rgbToFillStyle(getClearColor())
			drawer.Redraw()
			
			//TODO: Fix this later! Buttons should only be proxies for the real
			//colors stored in each frame! Don't set the palette based on the
			//buttons, set the palette when the user changes the color and ping
			//the palette back to the buttons (maybe with a call to "select" again)
			frame.palette = ChatDrawUtilities.StringToPalette(getButtonColorString())
			animateFrames.SetFrame(frame)
		})
		
		//Set up the various control buttons (like submit, clear, etc.)
		clearButton.innerHTML = "✖"
		clearButton.addEventListener("click", function() {
			if (drawer.StrokeCount()) drawer.UpdateUndoBuffer()
			CanvasUtilities.Clear(animateFrames.GetFrame().canvas,
										 rgbToFillStyle(getClearColor()))
			drawer.Redraw()
		})
		drawArea.id = drawAreaID
		drawArea.setAttribute("tabindex", "-1")
		drawArea.addEventListener("keydown", function(ev) {
			if (drawArea.dataset.hidden) return
			if (ev.keyCode === 40)
				selectNextRadio()
			if (ev.keyCode === 38)
				selectPreviousRadio()
		})
		widthButton.innerHTML = String(defaultLineWidth - 1)
		widthButton.setAttribute("data-width", String(defaultLineWidth - 1))
		widthButton.addEventListener("click", widthToggle.callBind(widthButton))
		sendButton.innerHTML = "➥"
		sendButton.dataset.button = "sendDrawing"
		sendButton.addEventListener("click", function() {sendDrawing() })
		toggleButton.innerHTML = "✎"
		toggleButton.addEventListener("click", toggleInterface)
		cSizeButton.innerHTML = "◲"
		cSizeButton.addEventListener("click", scaleInterface)
		undoButton.innerHTML = "↶"
		undoButton.addEventListener("click", function() { drawer.Undo() })
		redoButton.innerHTML = "↷"
		redoButton.addEventListener("click", function() { drawer.Redo() })
		drawer.DoUndoStateChange()
		
		//These are the only elements that will be displayed if the drawing area
		//goes hidden. CSS doesn't have to look at these, ofc.
		toggleButton.setAttribute("data-keep", "true")
		buttonArea2.setAttribute("data-keep", "true")
		
		buttonArea.appendChild(cSizeButton)
		buttonArea.appendChild(undoButton)
		buttonArea.appendChild(redoButton)
		
		//Create the color picking buttons
		for (i = 0; i < ChatDrawUtilities.BaseColors.length; i++) {
			var colorButton = HTMLUtilities.CreateUnsubmittableButton() //makeUnsubmittableButton()
			
			colorButton.innerHTML = "■"
			colorButton.className = colorButtonClass
			colorButton.addEventListener("click", colorButtonSelect.callBind(colorButton, canvas))
			
			buttonArea.appendChild(colorButton)
			
			if (i === 1)
				colorButton.click()
		}
		
		buttonArea.appendChild(sendButton)
		
		buttonArea2.appendChild(moveButton)
		buttonArea2.appendChild(clearButton)
		buttonArea2.appendChild(widthButton)
		buttonArea2.appendChild(fillButton)
		buttonArea2.appendChild(lineButton)
		buttonArea2.appendChild(freehandButton)
		buttonArea2.appendChild(toggleButton)
		canvasContainer.appendChild(canvas)
		canvasContainer.appendChild(lightbox)
		drawArea.appendChild(canvasContainer)
		drawArea.appendChild(buttonArea)
		drawArea.appendChild(buttonArea2)
		drawArea.appendChild(colorPicker)
		
		//Before we finish entirely, set up the animation area.
		var animateArea = document.createElement("animate-area")
		var animateScroller = document.createElement("animate-scroller")
		var animateControls = document.createElement("button-area")
		var animateSave = document.createElement("button-area")
		var newFrame = HTMLUtilities.CreateUnsubmittableButton("+")
		var frameSkip = document.createElement("input")
		var lightboxButton = HTMLUtilities.CreateUnsubmittableButton("0")
		var repeatAnimation = HTMLUtilities.CreateUnsubmittableButton("→")
		var exportAnimation = HTMLUtilities.CreateUnsubmittableButton("⛟")
		var sendAnimation = HTMLUtilities.CreateUnsubmittableButton("➥")
		var playPause = HTMLUtilities.CreateUnsubmittableButton("►")
		var saveAnimationButton = HTMLUtilities.CreateUnsubmittableButton("📝")
		var loadAnimationButton = HTMLUtilities.CreateUnsubmittableButton("☝")
		var listAnimations = HTMLUtilities.CreateUnsubmittableButton("L")
		saveInput = document.createElement("input")
		saveInput.setAttribute("name", "name")
		saveInput.setAttribute("placeholder", "Animation Name")
		saveAnimationButton.setAttribute("title", "Save animation to server")
		loadAnimationButton.setAttribute("title", "Load animation from server")
		listAnimations.setAttribute("title", "List all animations (in chat)")
		lightboxButton.setAttribute("title", "Lightbox toggle")
		exportAnimation.setAttribute("title", "Export animation to gif")
		playPause.setAttribute("title", "Play / Stop animation")
		repeatAnimation.setAttribute("title", "Toggle animation loop")
		newFrame.setAttribute("title", "Insert new frame after current")
		sendAnimation.setAttribute("title", "Send animation in chat")
		sendAnimation.dataset.button = "sendAnimation"
		
		frameSkip.setAttribute("type", "number")
		frameSkip.setAttribute("min", "1")
		frameSkip.setAttribute("max", "600")
		frameSkip.setAttribute("placeholder", "1=60fps")
		frameSkip.setAttribute("title", "Frame skip (1=60fps)")
		frameSkip.value = 3
		
		lightboxButton.addEventListener("click", function(event) {
			var next = Number(lightboxButton.innerHTML) + 1
			if (next > 3) next = -3
			lightboxButton.innerHTML = String(next)
			animateFrames.SelectFrameIndex(animateFrames.GetSelectedFrameIndex())
		})
		
		var saveAnimationWrapper = function(name) {
			UXUtilities.Toast("Saving... please wait")
			animationPlayer.frames = animateFrames.GetAllFrames()
			var object = animationPlayer.ToStorageObject()
			writePersistent(name + animationTag, object, function() {
				UXUtilities.Toast("Saved animation '" + name + "'")
			})
		}
		
		var loadAnimationWrapper = function(name) {
			readPersistent(name + animationTag, function(value) {
				//Perform the version 1 conversion... eugh
				if (!value.version || value.version < 2) {
					var loadCount = 0
					value.times = value.frames
					value.data = []
					value.version = 2
					
					console.log("Loading an older animation")
					
					for (var i = 0; i < value.times.length; i++) {
						/* jshint ignore:start */
						let index = i
						readPersistent(name + animationTag + "_" + index, function(drawing) {
							value.data[index] = drawing
							loadCount++
							
							if (loadCount === value.times.length) {
								loadAnimation(value)
								UXUtilities.Toast("Loaded animation '" + name + "'")
							}
						})
						/* jshint ignore:end */
					}
				} else {
					loadAnimation(value)
					UXUtilities.Toast("Loaded animation '" + name + "'")
				}
			})
		}
		
		saveAnimationButton.addEventListener("click", function(event) {
			if (!saveInput.value) {
				UXUtilities.Toast("You must give the animation a name!")
				return
			}
			
			getAnimations(function(anims) {
				if (ArrayUtilities.Contains(anims, saveInput.value)) {
					UXUtilities.Confirm("There's already an animation named " +
											  saveInput.value + ", are you sure you want to overwrite it?",
											  function(confirmed) {
												  if (confirmed) saveAnimationWrapper(saveInput.value)
											  })
				} else {
					saveAnimationWrapper(saveInput.value)
				}
			})
		})
		
		listAnimations.addEventListener("click", function(event) {
			getAnimations(function(anims) {
				localModuleMessage("Your animations: \n" + anims.join("\n"))
			}, listAnimations)
		})
		
		loadAnimationButton.addEventListener("click", function(event) {
			if (!saveInput.value) {
				UXUtilities.Toast("You must give a name to load an animation!")
				return
			}
			getAnimations(function(anims) {
				if (!ArrayUtilities.Contains(anims, saveInput.value)) {
					UXUtilities.Toast("Couldn't find animation " + saveInput.value)
					return
				}
				UXUtilities.Confirm("You will lose any unsaved progress. Are you sure you want to load " +
										  saveInput.value + "?", function(confirmed) {
											  if (confirmed) loadAnimationWrapper(saveInput.value)
										  })
			})
		})
		
		newFrame.addEventListener("click", function(event) {
			animateFrames.InsertNewFrame(animateFrames.GetSelectedFrameIndex(), true)
		})
		
		repeatAnimation.addEventListener("click", function(event) {
			if (repeatAnimation.hasAttribute("data-repeat")) {
				repeatAnimation.removeAttribute("data-repeat")
				repeatAnimation.innerHTML = "→"
			} else {
				repeatAnimation.setAttribute("data-repeat", "true")
				repeatAnimation.innerHTML = "⟲"
			}
		})
		
		sendAnimation.addEventListener("click", function(event) {
			UXUtilities.Confirm("A copy of your current animation will be created and become publicly available. " +
									  "Animation will use the currently selected frame as a title card. " +
									  "Are you sure you want to post your animation?", function(confirmed) {
										  if (!confirmed) return
										  UXUtilities.Toast("Uploading animation... please wait")
										  animationPlayer.frames = animateFrames.GetAllFrames()
										  var animation = animationPlayer.ToStorageObject()
										  var uploadData = new FormData()
										  uploadData.append("text", JSON.stringify(animation))
										  RequestUtilities.XHRSimple(location.protocol + "//kland.smilebasicsource.com/uploadtext",
																			  function(response) {
																				  if (response.startsWith("http")) {
																					  sendDrawing(response)
																				  } else {
																					  UXUtilities.Toast("The animation failed to upload! " + response)
																				  }
																			  }, uploadData)
									  })
		})
		
		exportAnimation.addEventListener("click", function() {
			UXUtilities.Confirm("Your animation will be captured as-is and turned into a gif. " +
									  "Frame timings may be slightly off due to gif timings, particularly lower frame times. " +
									  "Are you ready to export your animation?", function(confirmed) {
										  if (!confirmed) return
										  UXUtilities.Toast("Exporting animation... please wait")
										  animationPlayer.frames = animateFrames.GetAllFrames()
										  var animation = animationPlayer.ToStorageObject(true)
										  var uploadData = new FormData()
										  uploadData.append("animation", JSON.stringify(animation))
										  uploadData.append("bucket", ChatDrawUtilities.ExportBucket()) //"chatDrawAnimations")
										  RequestUtilities.XHRSimple(location.protocol + "//kland.smilebasicsource.com/uploadimage",
																			  function(response) {
																				  if (response.startsWith("http")) {
																					  window.open(response, "_blank")
																				  } else {
																					  console.log(response)
																					  UXUtilities.Toast("The animation failed to upload! " + response)
																				  }
																			  }, uploadData)
									  })
		})
		
		animationPlayer = new AnimationPlayer(canvas, false,
														  function(newValue) {
															  if (newValue === undefined) {
																  return repeatAnimation.hasAttribute("data-repeat")
															  } else {
																  if (newValue != repeatAnimation.hasAttribute("data-repeat"))
																	  repeatAnimation.click()
															  }
														  },
														  function(newValue) {
															  if (newValue === undefined)
																  return frameSkip.value
															  else
																  frameSkip.value = newValue
														  })
		
		animationPlayer.OnPlay = function(player) {
			if (!frameSkip.value) {
				UXUtilities.Toast("Invalid frametime value")
				return false
			}
			
			player.frames = animateFrames.GetAllFrames()
			
			player.disabledAction = drawer.OnAction
			drawer.OnAction = function() {}
			newFrame.disabled = true
			buttonArea.disabled = true
			playPause.innerHTML = "■"
			lightbox.style.display = "none"
		}
		
		animationPlayer.OnStop = function(player) {
			playPause.innerHTML = "►"
			drawer.OnAction = player.disabledAction
			newFrame.disabled = false
			buttonArea.disabled = false
			drawer.Redraw()
			lightbox.style.display = ""
		}
		
		playPause.addEventListener("click", function(event) {
			if (animationPlayer.IsPlaying())
				animationPlayer.Stop()
			else
				animationPlayer.Play(animateFrames.GetSelectedFrameIndex())
		})
		
		animateControls.appendChild(newFrame)
		animateControls.appendChild(frameSkip)
		animateControls.appendChild(lightboxButton)
		animateControls.appendChild(repeatAnimation)
		animateControls.appendChild(exportAnimation)
		animateControls.appendChild(sendAnimation)
		animateControls.appendChild(playPause)
		animateScroller.appendChild(frameContainer) //animateFrames)
		animateSave.appendChild(saveInput)
		animateSave.appendChild(saveAnimationButton)
		animateSave.appendChild(loadAnimationButton)
		animateSave.appendChild(listAnimations)
		animateArea.appendChild(animateControls)
		animateArea.appendChild(animateScroller)
		animateArea.appendChild(animateSave)
		
		if (allowAnimation) drawArea.appendChild(animateArea)
		
		messagePane.appendChild(drawArea)
		
		//Make sure the interface is hidden, since we create it exposed.
		animateFrames.SelectFrameIndex(0)
		widthButton.click()
		freehandButton.click()
		toggleInterface({target : toggleButton})
		
		drawArea.dataset.scale =
			String(MathUtilities.MinMax(Math.floor((drawArea.getBoundingClientRect().right - 200) / 200), 1, 3))
		
		drawer.moveToolClearColor = rgbToFillStyle(getClearColor())
		
		//Now set up the overall document events.
		if (!skipChatSetup)
			document.querySelector("#sendpane textarea").addEventListener("keyup", onKeyUp)
	}
	
	var interfaceVisible = function() {
		try {
			return !document.getElementById(drawAreaID).dataset.hidden
		} catch(ex) {
			console.log("Error while checking interface visibility: " + ex)
		}
	}
	
	var toggleInterface = function(event, allowResize) {
		try {
			var container = document.getElementById(drawAreaID)
			
			if (container.dataset.hidden)
				container.removeAttribute("data-hidden")
			else
				container.setAttribute("data-hidden", "true")
			
			if (drawIframe && !firstTimeRecentered && (allowResize !== false)) {
				console.debug("DOING A HIDDEN DISPLAY FORCE SIZE HACK")
				drawIframe.contentWindow.postMessage({recenter:true}, "*")
				drawIframe.contentWindow.postMessage({recenter:true}, "*")
				//because I don't feel like figuring out why it requires two so I
				//just let it happen twice.
				firstTimeRecentered = true
			}
		} catch(ex) {
			console.log("Error while toggling drawing interface: " + ex)
		}
	}
	
	var dockInterface = function(dock, drawArea) {
		try {
			drawArea = drawArea || document.getElementById(drawAreaID)
			var positionButton = drawArea.querySelector("button.position")
			if (dock) {
				drawArea.setAttribute("data-docked", "true")
				positionButton.innerHTML = "◱"
				writeStorage("chatDrawDocked", true)
			} else {
				drawArea.removeAttribute("data-docked")
				positionButton.innerHTML = "◲"
				writeStorage("chatDrawDocked", false)
			}
		} catch(ex) {
			console.log("Error while docking drawing interface: " + ex)
		}
	}
	
	var scaleInterface = function(event) {
		try {
			var container = document.getElementById(drawAreaID)
			var rect = container.getBoundingClientRect()
			
			var scale = Number(container.dataset.scale)
			var originalWidth = rect.width / scale
			
			//Figure out the NEXT scale.
			if (scale < maxScale && rect.right - originalWidth * (scale + 1) - 200 > 5)
				scale++
			else
				scale = 1
			
			container.dataset.scale = String(scale)
		} catch(ex) {
			console.log("Error while scaling drawing interface: " + ex)
		}
	}
	
	//The function that is called when the given colorButton is selected. The
	//canvas is also given so that colors may be swapped if necessary
	var colorButtonSelect = function(colorButton, canvas) {
		var alreadySelected = colorButton.dataset.selected
		var buttons = getColorButtons()
		
		//Reset everything
		for (var i = 0; i < buttons.length; i++) {
			buttons[i].removeAttribute("data-selected")
		}
		
		//Set current button to this one.
		colorButton.dataset.selected = "true"
		
		//If this button was already selected, perform the color swap.
		if (alreadySelected) {
			var colorPicker = document.getElementById(colorPickerID)
			colorPicker.associatedButton = colorButton
			colorPicker.value = rgbToHex(fillStyleToRgb(colorButton.style.color))
			colorPicker.focus()
			colorPicker.click()
		} else {
			drawer.color = colorButton.style.color
		}
	}
	
	//Send the current drawing to the chat.
	var sendDrawing = function(animationLink) {
		$sendDrawing.click() //hack!
		/*try {
		  var message = animateFrames.GetFrame().ToString()
		  if (animationLink) message = "(" + animationLink + ")" + message
		  sendMessage("/drawsubmit " + message, false)
		  } catch(ex) {
		  console.log("Error while sending drawing: " + ex)
		  }*/
	}
	
	var sendDrawing2 = function() {
		drawIframe.contentWindow.postMessage({uploadImage:true}, "*")
	}
	
	//Get the colors from the drawing area buttons
	var getButtonColors = function() {
		var colors = []
		var buttons = getColorButtons()
		
		for (var i = 0; i < buttons.length; i++)
			colors.push(fillStyleToRgb(buttons[i].style.color))
		
		return colors
	}
	
	//Get the color that is best suited to be a clearing color (the color that
	//is closest to either white or black, whichever comes first)
	var getClearColor = function() {
		var colors = getButtonColors()
		var max = 0
		var clearColor = 0
		
		for (var i = 0; i < colors.length; i++) {
			var full = Math.pow((colors[i][0] + colors[i][1] + colors[i][2] - (255 * 3 / 2 - 0.1)), 2)
			
			if (full > max) {
				max = full
				clearColor = i
			}
		}
		
		return colors[clearColor]
	}
	
	//Get the buttons representing the color switching
	var getColorButtons = function() {
		return document.querySelectorAll("#" + drawAreaID + " button-area button." + colorButtonClass)
	}
	
	var onKeyUp = function(event) {
		try {
			var drawArea = document.getElementById(drawAreaID)
			if (event.target.value.length > hideCharacters)
				drawArea.style.visibility = "hidden"
			else
				drawArea.style.visibility = "visible"
		} catch(ex) {
			console.log("Couldn't hide or unhide drawing toggle: " + ex)
		}
	}
	
	return {
		"getColorButtons" : getColorButtons,
		"checkMessageForDrawing" : checkMessageForDrawing,
		"setupInterface" : setupInterface,
		"setupAdvancedInterface" : setupInterface2,
		"getButtonColors" : getButtonColors,
		"drawingWidth" : chatDrawCanvasWidth,
		"drawingHeight" : chatDrawCanvasHeight,
		"createToolButton" : createToolButton,
		"getDrawer" : function() { return drawer },
		"getAnimateFrames" : function() { return animateFrames },
		"getAnimationPlayer" : function() { return animationPlayer },
		"loadAnimation" : loadAnimation
	}
	
})()

;(function() {
	
	window.addEventListener("load", onLoad)
	
	function onLoad(event) {
		LocalChatDraw.setupInterface()
	}
})()

//The legacy fixed palette, if you need it.
var legacyPalette = [[255,255,255],
							[0,0,0],
							[255,0,0],
							[0,0,255]]

//Convert a 3 channel palette color into a fill style
function rgbToFillStyle(channels) {
	return "rgb(" + channels[0] + "," + channels[1] + "," + channels[2] + ")"
}

//Convert back from the rgba fill style to an array
function fillStyleToRgb(fillStyle) {
	var regex = /^\s*rgba?\(\s*([0-9]+)\s*,\s*([0-9]+)\s*,\s*([0-9]+)\s*\)\s*$/i
	var result = regex.exec(fillStyle)
	return result ? [ Number(result[1]), Number(result[2]), Number(result[3]) ] : null
}

//Convert a hex color into RGB values
function hexToRGB(hex) {
	// Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
	var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i
	hex = hex.replace(shorthandRegex, function(m, r, g, b) {
		return r + r + g + g + b + b
	})
	
	var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
	return result ? [
		parseInt(result[1], 16),
		parseInt(result[2], 16),
		parseInt(result[3], 16)
	] : null
}

function rgbToHex(channels) {
	return "#" + ((1 << 24) + (channels[0] << 16) + (channels[1] << 8) + channels[2]).toString(16).slice(1)
}

function AnimatorFrameSet(container) {
	this.container = container
	
	this.FrameTag = "animate-frame"
	this.FrameControlTag = "frame-controls"
	this.FramePaletteAttribute = "data-palette"
	this.FrameTimeAttribute = "data-time"
	this.SelectedAttribute = "data-selected"
	
	this.OnFrameSelected = false
	
	this.FrameTimeMax = 6000
	this.FrameTimeMin = 1
}

AnimatorFrameSet.prototype.FrameSelected = function(frameData) {
	if (this.OnFrameSelected) this.OnFrameSelected(frameData)
}

AnimatorFrameSet.prototype.ClearAllFrames = function() {
	this.container.innerHTML = ""
}

AnimatorFrameSet.prototype._GetAllFrameElements = function(selectedOnly) {
	return this.container.querySelectorAll(":scope > " + this.FrameTag +
														(selectedOnly ? '[' + this.SelectedAttribute + ']' : ""))
}

AnimatorFrameSet.prototype._GetIndexOfFrame = function(frame) {
	var elements = this._GetAllFrameElements()
	
	for (var i = 0; i < elements.length; i++) {
		if (elements[i].isSameNode(frame))
			return i
	}
	
	return -1
}

AnimatorFrameSet.prototype._IsSelected = function(frame) {
	return this._GetIndexOfFrame(frame) === this.GetSelectedFrameIndex()
}

AnimatorFrameSet.prototype._GetDataFromFrame = function(frameElement) {
	var element = frameElement.querySelector('[' + this.FrameTimeAttribute + ']')
	var time = Number(element.value)
	
	var frame = new AnimatorFrame(
		frameElement.querySelector("canvas"),
		ChatDrawUtilities.StringToPalette(frameElement.getAttribute(this.FramePaletteAttribute)),
		time <= this.FrameTimeMax && time >= this.FrameTimeMin ? time : 0
	)
	
	frame.timeElement = element
	return frame
}

//Fill the given frame element with the given data (for instance, set palette,
//time, etc)
AnimatorFrameSet.prototype._FillFrameWithData = function(frameElement, frameData) {
	frameElement.setAttribute(this.FramePaletteAttribute,
									  ChatDrawUtilities.PaletteToString(frameData.palette))
	
	var original = this._GetDataFromFrame(frameElement)
	
	//Fill canvas IF it's not exactly the same canvas
	if (!original.canvas.isSameNode(frameData.canvas))
		CanvasUtilities.CopyInto(original.canvas.getContext("2d"), frameData.canvas)
	
	if (frameData.time)
		original.timeElement.value = frameData.time
	else
		original.timeElement.value = ""
}

AnimatorFrameSet.prototype._SelectFrame = function(frameElement) {
	//First, get rid of all selected attributes
	var selected = this._GetAllFrameElements(true)
	var i
	
	for (i = 0; i < selected.length; i++)
		selected[i].removeAttribute(this.SelectedAttribute)
	
	frameElement.setAttribute(this.SelectedAttribute, "true")
	this.FrameSelected(this._GetDataFromFrame(frameElement))
}

//Insert a new frame AFTER the given index. If index is negative or there are
//no frames, frame is inserted at beginning.
AnimatorFrameSet.prototype.InsertNewFrame = function(index, selectNow) {
	var palette
	var canvas = ChatDrawUtilities.CreateCanvas()
	var me = this
	
	try { palette = this.GetFrame().palette } catch (ex) { palette = ChatDrawUtilities.BaseColors }
	
	CanvasUtilities.Clear(canvas, ChatDrawUtilities.GetClearColor(palette).ToRGBString())
	
	var frameData = new AnimatorFrame(canvas, palette, 0)
	
	var frame = document.createElement(this.FrameTag)
	var frameControls = document.createElement(this.FrameControlTag)
	var frameTime = document.createElement("input")
	var frameCopy = HTMLUtilities.CreateUnsubmittableButton("📋")
	var framePaste = HTMLUtilities.CreateUnsubmittableButton("📤")
	var frameDelete = HTMLUtilities.CreateUnsubmittableButton("✖")
	
	frameTime.setAttribute(this.FrameTimeAttribute, "")
	frameTime.className = "left"
	frameTime.title = "Individual frame time"
	frameCopy.className = "left"
	frameCopy.title = "Copy frame content"
	framePaste.title = "Paste frame content"
	frameDelete.className = "alerthover"
	frameDelete.title = "Delete frame (cannot be undone!)"
	
	frame.addEventListener("click", function(e) {
		me._SelectFrame(frame)
	})
	
	frameCopy.addEventListener("click", function(event) {
		StorageUtilities.WriteLocal(ChatDrawUtilities.ClipboardKey,
											 me._GetDataFromFrame(frame).ToString())
		UXUtilities.Toast("Copied frame to clipboard (chatdraw only!)")
	})
	
	framePaste.addEventListener("click", function(event) {
		var clipboard = StorageUtilities.ReadLocal(ChatDrawUtilities.ClipboardKey)
		var myData = me._GetDataFromFrame(frame)
		
		if (clipboard) {
			var newFrame = ChatDrawUtilities.ChatDrawToFrame(clipboard)
			newFrame.time = myData.time
			me._FillFrameWithData(frame, newFrame)
			
			//Reselect frame just in case
			if (me._IsSelected(frame)) me._SelectFrame(frame)
		} else {
			UXUtilities.Toast("No chatdraw on clipboard")
		}
	})
	
	frameDelete.addEventListener("click", function(event) {
		if (me.GetFrameCount() === 1) {
			UXUtilities.Toast("You can't delete the only frame!")
			return
		}
		
		UXUtilities.Confirm("Are you sure you want to delete this frame?", function(c) {
			if (c) {
				var toSelect = frame.nextElementSibling || frame.previousElementSibling
				
				//If you're deleting the selected frame, select the "next" frame
				if (me._IsSelected(frame))
					me._SelectFrame(toSelect)
				
				HTMLUtilities.RemoveSelf(frame)
			}
		})
	})
	
	frameControls.appendChild(frameTime)
	frameControls.appendChild(frameCopy)
	frameControls.appendChild(frameDelete)
	frameControls.appendChild(framePaste)
	frame.appendChild(canvas)
	frame.appendChild(frameControls)
	
	this._FillFrameWithData(frame, frameData)
	
	var frames = this._GetAllFrameElements()
	
	if (index >= frames.length)
		index = frames.length - 1
	
	if (frames.length === 0 || index < 0)
		HTMLUtilities.InsertFirst(frame, this.container)
	else
		HTMLUtilities.InsertAfterSelf(frame, frames[index])
	
	if (selectNow) this._SelectFrame(frame)
	
	return frameData
}

AnimatorFrameSet.prototype.GetFrame = function(index) {
	if (index === undefined) index = this.GetSelectedFrameIndex()
	var frames = this._GetAllFrameElements()
	return this._GetDataFromFrame(frames[index])
}

AnimatorFrameSet.prototype.SetFrame = function(frame, index) {
	if (index === undefined) index = this.GetSelectedFrameIndex()
	var frames = this._GetAllFrameElements()
	this._FillFrameWithData(frames[index], frame)
	if (index === this.GetSelectedFrameIndex())
		this.SelectFrameIndex(index)
}

AnimatorFrameSet.prototype.GetSelectedFrameIndex = function() {
	var allFrames = this._GetAllFrameElements()
	
	for (var i = 0; i < allFrames.length; i++) {
		if (allFrames[i].hasAttribute(this.SelectedAttribute))
			return i
	}
	
	return -1
}

AnimatorFrameSet.prototype.SelectFrameIndex = function(index) {
	var allFrames = this._GetAllFrameElements()
	this._SelectFrame(allFrames[index])
}

AnimatorFrameSet.prototype.GetAllFrames = function() {
	var allFrames = []
	var allElements = this._GetAllFrameElements()
	
	for (var i = 0; i < allElements.length; i++)
		allFrames.push(this._GetDataFromFrame(allElements[i]))
	
	return allFrames
}

AnimatorFrameSet.prototype.GetFrameCount = function() {
	return this._GetAllFrameElements().length
}

//An animator frame is just a container to hold data
function AnimatorFrame(canvas, palette, time) {
	this.canvas = canvas
	this.palette = palette
	this.time = time
}

AnimatorFrame.prototype.ToString = function() {
	return ChatDrawUtilities.FrameToChatDraw(this)
}

function AnimationPlayer(canvas, frames, repeatFunction, defaultTimeFunction) {
	var me = this
	
	this.canvas = canvas
	this.frames = frames
	
	this._hiddenRepeat = true
	this._hiddenDefaultTime = 3
	
	this.GetRepeat = repeatFunction || function(value) {
		if (value === undefined)
			return me._hiddenRepeat
		else
			me._hiddenRepeat = value
	}
	this.GetDefaultTime = defaultTimeFunction || function(value) {
		if (value === undefined)
			return me._hiddenDefaultTime
		else
			me._hiddenDefaultTime = value
	}
	
	this._playing = false
	this._frameCount = 0
	this._currentFrame = 0
	
	this.OnPlay = false
	this.OnStop = false
}

AnimationPlayer.prototype.IsPlaying = function() {
	return this._playing
}

AnimationPlayer.prototype._Animate = function() {
	if (this._playing) {
		var skip = this.frames[this._currentFrame - 1] && this.frames[this._currentFrame - 1].time ?
			 this.frames[this._currentFrame - 1].time : this.GetDefaultTime()
		
		if ((this._frameCount % skip) === 0) {
			this._frameCount = 0
			
			if (this._currentFrame >= this.frames.length && this.GetRepeat())
				this._currentFrame = 0
			
			if (this._currentFrame >= this.frames.length) {
				this.Stop()
				return
			}
			
			CanvasUtilities.CopyInto(this.canvas.getContext("2d"), this.frames[this._currentFrame].canvas)
			this._currentFrame++
		}
		
		this._frameCount++
		
		window.requestAnimationFrame(this._Animate.bind(this))
	}
}

AnimationPlayer.prototype.Play = function(startFrame) {
	if (this.OnPlay) {
		if (this.OnPlay(this) === false) {
			console.debug("Play was cancelled by OnPlay")
			return
		}
	}
	
	this._playing = true
	this._frameCount = 0
	this._currentFrame = 0
	if (startFrame !== undefined) this._currentFrame = startFrame
	
	this._Animate()
}

AnimationPlayer.prototype.Stop = function() {
	this._playing = false
	if (this.OnStop) this.OnStop(this)
}

AnimationPlayer.prototype.FromStorageObject = function(storeObject) {
	if (storeObject.version !== 2) {
		throw "Storage object must be converted to the latest version!"
	}
	
	this.frames = []
	
	for (var i = 0; i < storeObject.data.length; i++) {
		this.frames[i] = ChatDrawUtilities.ChatDrawToFrame(storeObject.data[i])
		this.frames[i].time = storeObject.times[i]
	}
	
	this.GetRepeat(storeObject.repeat)
	this.GetDefaultTime(storeObject.defaultFrames)
}

AnimationPlayer.prototype.ToStorageObject = function(pngs) {
	var baseData = {
		version : 2,
		defaultFrames: this.GetDefaultTime(),
		repeat : this.GetRepeat(),
		times : [],
		data : []
	}
	
	for (var i = 0; i < this.frames.length; i++) {
		if (this.frames[i].time)
			baseData.times.push(this.frames[i].time)
		else
			baseData.times.push(0)
		
		if (pngs)
			baseData.data.push(this.frames[i].canvas.toDataURL("image/png"))
		else
			baseData.data.push(this.frames[i].ToString())
	}
	
	return baseData
}

//AnimationPlayer.prototype.To

var ChatDrawUtilities =
	 {
		 DefaultWidth : 200,
		 DefaultHeight : 100,
		 ClipboardKey : "chatdrawClipboard",
		 ExportBucket : function() {
			 return "chatDrawAnimations"
		 },
		 
		 BaseColors : [
			 new Color(255,255,255),
			 new Color(0, 0, 0),
			 new Color(255, 0, 0),
			 new Color(0, 0, 255)
		 ],
		 LegacyColors : [
			 new Color(255,255,255),
			 new Color(0, 0, 0),
			 new Color(255, 0, 0),
			 new Color(0, 0, 255)
		 ],
		 
		 PaletteToString : function(palette) {
			 var colorSet = ""
			 
			 for (var i = 0; i < palette.length; i++) {
				 colorSet += palette[i].ToRGBString()
				 if (i !== palette.length - 1) colorSet += "/"
			 }
			 
			 return colorSet
		 },
		 StringToPalette : function(string) {
			 var colors = string.split("/")
			 var result = []
			 
			 for (var i = 0; i < colors.length; i++)
				 result.push(StyleUtilities.GetColor(colors[i]))
			 
			 return result
		 },
		 
		 GetClearColor : function(palette) {
			 var max = 0
			 var clearColor = 0
			 
			 for (var i = 0; i < palette.length; i++) {
				 var full = Math.pow((palette[i].r + palette[i].g + palette[i].b - (255 * 3 / 2 - 0.1)), 2)
				 
				 if (full > max) {
					 max = full
					 clearColor = i
				 }
			 }
			 
			 return palette[clearColor]
		 },
		 
		 CreateCanvas : function() {
			 var canvas = document.createElement("canvas")
			 canvas.width = ChatDrawUtilities.DefaultWidth
			 canvas.height = ChatDrawUtilities.DefaultHeight
			 canvas.getContext("2d").imageSmoothingEnabled = false
			 return canvas
		 },
		 
		 //First canvas is bottom
		 CreateLightbox : function(frames, destination, opacities) {
			 CanvasUtilities.Clear(destination)
			 
			 var context = destination.getContext("2d")
			 
			 for (var i = 0; i < frames.length; i++) {
				 //This might be expensive! Make sure the browser doesn't slow down
				 //from all these created canvases!
				 var copy = CanvasUtilities.CreateCopy(frames[i].canvas, frames[i].canvas)
				 var clearColor = ChatDrawUtilities.GetClearColor(frames[i].palette)
				 CanvasUtilities.SwapColor(copy.getContext("2d"), clearColor,
													new Color(clearColor.r, clearColor.g, clearColor.b, 0), 0)
				 //context.globalAlpha = MathUtilities.Lerp(minAlpha, maxAlpha, (i + 1) / frames.length)
				 context.globalAlpha = opacities[i]
				 context.drawImage(copy,0,0)
			 }
		 },
		 
		 FrameToChatDraw : function(frame) {
			 var time = performance.now()
			 
			 var canvas = frame.canvas
			 var palette = frame.palette
			 
			 //Get that 2d context yo. Oh and also, the pixel data and whatever.
			 var context = canvas.getContext("2d")
			 var imageData = context.getImageData(0,0,canvas.width,canvas.height)
			 var pixelData = imageData.data
			 var bitsPerPixel = Math.ceil(Math.log2(palette.length))
			 var pixelsPerByte = Math.floor(8 / bitsPerPixel)
			 var currentPalette = 0
			 var currentByte = 0
			 var baseData = ""
			 var i = 0, j = 0, k = 0
			 
			 var paletteArray = []
			 
			 for (i = 0; i < palette.length; i++)
				 paletteArray.push(palette[i].ToArray())
			 
			 //Go by 4 because RGBA. Data is encoded in row-major order.
			 for (i = 0; i < pixelData.length; i+=4) {
				 //Shift is how much to shift the current palette value. All this math
				 //and we still can't add up T_T
				 shift = ((i / 4) % pixelsPerByte) * bitsPerPixel
				 
				 //Merge character into base data string.
				 if (i !== 0 && shift === 0) {
					 baseData += String.fromCharCode(currentByte)
					 currentByte = 0
				 }
				 
				 //This is the palette representation of the current pixel.
				 currentPalette = 0
				 
				 //Check pixel color against palette colors to get palette value.
				 for (j = 0; j < paletteArray.length; j++) {
					 if (paletteArray[j][0] === pixelData[i] &&
						  paletteArray[j][1] === pixelData[i + 1] &&
						  paletteArray[j][2] === pixelData[i + 2]) {
						 currentPalette = j
						 break
					 }
				 }
				 
				 //Add palette to current byte.
				 currentByte += currentPalette << shift
			 }
			 
			 //ALWAYS add the last byte because no matter what, there WILL be extra
			 //data leftover, since the current byte is added at the start of the loop
			 baseData += String.fromCharCode(currentByte)
			 
			 //OY! Before you go, add all the palette data. Yeah that's right, we
			 //encode the full RGB color space in the palette data. So what?
			 for (i = 0; i < paletteArray.length; i++)
				 for (j = 0; j < 3; j++) //DO NOT INCLUDE THE ALPHA CHANNEL!
					 baseData += String.fromCharCode(paletteArray[i][j])
			 
			 baseData += String.fromCharCode(paletteArray.length)
			 
			 var encodedString = LZString.compressToBase64(baseData)
			 
			 return encodedString
		 },
		 
		 ChatDrawToFrame : function(string) {
			 //Legacy images need their original palette. The new images will have the
			 //palette encoded within them.
			 var width = ChatDrawUtilities.DefaultWidth
			 var height = ChatDrawUtilities.DefaultHeight
			 var palette = ChatDrawUtilities.LegacyColors //ChatDrawUtilities.BaseColors; //legacyPalette.slice()
			 var realData = LZString.decompressFromBase64(string)
			 var i, j, k
			 
			 //Fix up the palette data based on legacy support. If legacy is detected
			 //(ie we have less than or equal to the minimum amount of bytes necessary)
			 //then use default palette. Otherwise, the number of bytes afterwards
			 //determines how the data is encoded.
			 if (realData.length > Math.ceil((width * height)/ 4)) {
				 //The very last byte tells us how many palette colors there are.
				 var paletteCount = realData.charCodeAt(realData.length - 1)
				 
				 palette = []
				 
				 //Now read all the "apparent" palette bytes.
				 for (i = 0; i < paletteCount; i++) {
					 var color = []
					 
					 //build color from 3 channels
					 for (j = 0; j < 3; j++)
						 color.push(realData.charCodeAt(realData.length - 1 - (paletteCount - i) * 3 + j))
					 
					 palette.push(new Color(color[0], color[1], color[2]))
				 }
			 }
			 
			 var canvas = document.createElement("canvas")
			 canvas.width = width
			 canvas.height = height
			 
			 var context = canvas.getContext("2d")
			 
			 var imageData = context.getImageData(0, 0, canvas.width, canvas.height)
			 var pixelData = imageData.data
			 var totalPixels = Math.floor(pixelData.length / 4)
			 
			 var currentByte
			 var currentPalette
			 var currentPixel = 0
			 var bitsPerPixel = Math.ceil(Math.log2(palette.length))
			 var pixelsPerByte = Math.floor(8 / bitsPerPixel)
			 byte_loop: //loop over all the bytes.
			 for (i = 0; i < realData.length; i++) {
				 currentByte = realData.charCodeAt(i)
				 
				 //Loop over the pixels within the bytes! Usually 4 for legacy
				 for (j = 0; j < pixelsPerByte; j++) {
					 //AND out the bits that we actually want.
					 currentPalette = currentByte & ((1 << bitsPerPixel) - 1)
					 
					 //That times 4 is because pixels are 4 bytes and whatever.
					 pixelData[currentPixel * 4] =		 palette[currentPalette].r //[0]
					 pixelData[currentPixel * 4 + 1] = palette[currentPalette].g //[1]
					 pixelData[currentPixel * 4 + 2] = palette[currentPalette].b //[2]
					 pixelData[currentPixel * 4 + 3] = 255
					 
					 //Shift over to get the next set of bits.
					 currentByte = currentByte >> bitsPerPixel
					 currentPixel++
					 
					 //Stop entire execution when we reach the end of the pixels.
					 if (currentPixel >= totalPixels)
						 break byte_loop
				 }
			 }
			 
			 // Draw the ImageData at the given (x,y) coordinates.
			 context.putImageData(imageData, 0, 0)
			 return new AnimatorFrame(canvas, palette, 0)
		 }
	 }
