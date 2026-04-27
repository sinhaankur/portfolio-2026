/**
 * Dynamic Bot Engine
 * Uses BOT_CONFIG from bot-config.js to drive the conversation
 * Easily customize by editing bot-config.js
 */

$(function() {
	var now = new Date();
	
	// Initialize the messenger with bot config
	var messenger = $('.screen-content').fbMessenger({
		botName: BOT_CONFIG.botName,
		botLogoUrl: BOT_CONFIG.botLogoUrl,
		loop: BOT_CONFIG.loop
	});
	
	// Process the conversation sequence
	BOT_CONFIG.conversation.forEach(function(action) {
		switch(action.type) {
			case 'start':
				messenger.fbMessenger('start', { delay: action.delay });
				break;
				
			case 'typingIndicator':
				messenger.fbMessenger('typingIndicator', { delay: action.delay });
				break;
				
			case 'message':
				messenger.fbMessenger('message', action.sender, action.text, {
					timestamp: now,
					delay: action.delay
				});
				break;
				
			case 'template':
				if (action.template === 'generic') {
					messenger.fbMessenger('showGenericTemplate', action.items, {
						delay: action.delay
					});
				}
				break;
				
			case 'quickReplies':
				var replyLinks = action.replies.map(function(reply) {
					var target = reply.target ? ' target="' + reply.target + '"' : '';
					return '<a href="' + reply.url + '"' + target + '>' + reply.text + '</a>';
				});
				
				messenger.fbMessenger('showQuickReplies', replyLinks, {
					timestamp: now,
					delay: action.delay
				});
				break;
				
			case 'customMessage':
				if (action.handler === 'handleBookingMentorship') {
					// Listen for quick reply clicks
					setTimeout(function() {
						$('.fbmessenger-quick-replies a').off('click').on('click', function(e) {
							var text = $(this).text();
							if (text === 'Book a Meeting') {
								messenger.fbMessenger('message', 'bot', 'Great! I can help you book a meeting. Would you like to use the booking form or provide details here?', { delay: 800 });
								setTimeout(function() {
									messenger.fbMessenger('showQuickReplies', [
										'<a href="booking.html">Use Booking Form</a>',
										'<a href="#" id="inline-booking">Provide Details Here</a>'
									], { delay: 800 });
									// Inline booking handler
									setTimeout(function() {
										$('#inline-booking').off('click').on('click', function(ev) {
											ev.preventDefault();
											messenger.fbMessenger('message', 'bot', 'Please enter your name, email, and preferred date/time for the meeting. (Format: Name, Email, Date, Time)', { delay: 800 });
											// Listen for user input in chat
											var chatInput = $('.fbmessenger-input input');
											chatInput.off('keydown').on('keydown', function(e) {
												if (e.key === 'Enter') {
													var val = chatInput.val();
													var parts = val.split(',');
													if (parts.length >= 4) {
														var name = parts[0].trim();
														var email = parts[1].trim();
														var date = parts[2].trim();
														var time = parts[3].trim();
														messenger.fbMessenger('message', 'user', val, { delay: 400 });
														messenger.fbMessenger('message', 'bot', 'Thanks! Pre-filling the booking form for you...', { delay: 800 });
														// Pre-fill booking form if present
														if (window.location.pathname.endsWith('index.html') || window.location.pathname === '/' || window.location.pathname === '/index.html') {
															window.location.href = 'booking.html?name=' + encodeURIComponent(name) + '&email=' + encodeURIComponent(email) + '&date=' + encodeURIComponent(date) + '&time=' + encodeURIComponent(time);
														} else if (document.getElementById('bookingForm')) {
															document.getElementById('name').value = name;
															document.getElementById('email').value = email;
															document.getElementById('preferredDate').value = date;
															document.getElementById('preferredTime').value = time;
														}
														chatInput.val('');
													}
												}
											});
										});
									}, 100);
								}, 900);
							} else if (text === 'Connect for Mentorship') {
								messenger.fbMessenger('message', 'bot', 'Awesome! You can book a mentorship session using the booking form, or tell me your details here.', { delay: 800 });
								setTimeout(function() {
									messenger.fbMessenger('showQuickReplies', [
										'<a href="booking.html">Use Booking Form</a>',
										'<a href="#" id="inline-mentorship">Provide Details Here</a>'
									], { delay: 800 });
									setTimeout(function() {
										$('#inline-mentorship').off('click').on('click', function(ev) {
											ev.preventDefault();
											messenger.fbMessenger('message', 'bot', 'Please enter your name, email, and what you are looking for in mentorship. (Format: Name, Email, Topic)', { delay: 800 });
											var chatInput = $('.fbmessenger-input input');
											chatInput.off('keydown').on('keydown', function(e) {
												if (e.key === 'Enter') {
													var val = chatInput.val();
													var parts = val.split(',');
													if (parts.length >= 3) {
														var name = parts[0].trim();
														var email = parts[1].trim();
														var topic = parts.slice(2).join(',').trim();
														messenger.fbMessenger('message', 'user', val, { delay: 400 });
														messenger.fbMessenger('message', 'bot', 'Thanks! Pre-filling the mentorship booking form for you...', { delay: 800 });
														if (window.location.pathname.endsWith('index.html') || window.location.pathname === '/' || window.location.pathname === '/index.html') {
															window.location.href = 'booking.html?name=' + encodeURIComponent(name) + '&email=' + encodeURIComponent(email) + '&topic=' + encodeURIComponent(topic) + '&sessionType=mentoring';
														} else if (document.getElementById('bookingForm')) {
															document.getElementById('name').value = name;
															document.getElementById('email').value = email;
															document.getElementById('topic').value = topic;
															document.getElementById('sessionType').value = 'mentoring';
														}
														chatInput.val('');
													}
												}
											});
										});
									}, 100);
								}, 900);
							}
						});
					}, 100);
				} else {
					messenger.fbMessenger('message', '', '', { delay: action.delay });
				}
				break;
		}
	});
	
	// Run the conversation
	messenger.fbMessenger('run');
});