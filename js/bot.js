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
				messenger.fbMessenger('message', '', '', { delay: action.delay });
				break;
		}
	});
	
	// Run the conversation
	messenger.fbMessenger('run');
});