$(function() {
	var now = new Date();
	$('.screen-content')
	.fbMessenger({
			botName: 'Ankur',
			botLogoUrl: 'img/logo-circ.svg',
			loop:false
		})
	.fbMessenger('start', { delay: 0 })
	.fbMessenger('typingIndicator', { delay: 1200 })
	.fbMessenger('message', 'bot', 'Hello! I am <b>Ankur</b>. Senior UX Designer at Oracle (DBTool Team)', { timestamp: now, delay: 1500 })
	//.fbMessenger('message', 'bot', 'Rollin<b>Oracle Canada</b> ', { timestamp: now, delay: 1200 })
	// .fbMessenger('showGenericTemplate', [
	// {
	// imageUrl: 'img/hey.gif',
	// title: '',
	// subtitle: '',
	// buttons: []
	// }
	// ], { delay: 1500 })

	//.fbMessenger('message', 'user', '🤙', { timestamp: now, delay: 3000 })
	//.fbMessenger('typingIndicator', { delay: 2500 })
	//.fbMessenger('message', 'bot', 'haha', { timestamp: now, delay: 1500 })
	.fbMessenger('typingIndicator', { delay: 1000 })
	.fbMessenger('message', 'bot', 'Working on cloud solution, designing a shared UX vision for an intergrated cloud platform. </b>', {delay: 1500 })
	.fbMessenger('showGenericTemplate', [
	{
	imageUrl: 'img/camera.gif',
	title: '',
	subtitle: '',
	buttons: []
	}
	], { delay: 2000 })
	.fbMessenger('typingIndicator', { delay: 2000 })
	.fbMessenger('message', 'bot', 'Scroll down for my work (last update 2021) or here are some links for you!', {delay: 1500 })
	.fbMessenger('message', '', '', {delay: 0 })
	.fbMessenger('showQuickReplies', 
     	[
	 	'<a href="#scroll-to-work" id="work-link">Learning</a>',
		'<a href="https://medium.com/@sinhaankur827" target="_blank">Medium Article</a>',
	 	'<a href="https://www.linkedin.com/in/sinhaankur27/" target="_blank">LinkedIn</a>'
	    ], { timestamp: now, delay: 1500 })
	// .fbMessenger('scrollQuickReplies', 3, { delay: 2000 })
	// .fbMessenger('scrollQuickReplies', 0, { delay: 1000 })
	// .fbMessenger('scrollQuickReplies', 4, { delay: 1000 })
	// .fbMessenger('selectQuickReply', 2, { delay: 1200 })
	// .fbMessenger('typingIndicator', { delay: 2000 })
	// .fbMessenger('message', 'bot', 'Obvious choice, haha', { timestamp: now, delay: 1000 })
	// .fbMessenger('typingIndicator', { delay: 200 })
	// .fbMessenger('message', 'bot', 'You gotta scroll down now.. DO IT!', { timestamp: now, delay: 800 })
	// .fbMessenger('message', '', '', { timestamp: now, delay: 0 })
	// .fbMessenger('message', '', '', { timestamp: now, delay: 0 })

	.fbMessenger('run');
});