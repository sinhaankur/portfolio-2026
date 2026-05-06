// Bot Configuration - Easy to customize
const BOT_CONFIG = {
  botName: 'Ankur AI',
  botLogoUrl: 'img/logo-circ.svg',
  loop: false,
  
  // Define the conversation flow as a sequence of actions
  conversation: [
    {
      type: 'start',
      delay: 0
    },
    {
      type: 'typingIndicator',
      delay: 1200
    },
    {
      type: 'message',
      sender: 'bot',
      text: 'Hello! I am <b>Ankur</b>. Principal UX Designer at Oracle (DBTool Team)',
      delay: 1500
    },
    {
      type: 'typingIndicator',
      delay: 1000
    },
    {
      type: 'message',
      sender: 'bot',
      text: 'Working on cloud solution, designing a shared UX vision for an integrated cloud platform.',
      delay: 1500
    },
    {
      type: 'template',
      template: 'generic',
      items: [
        {
          imageUrl: 'img/camera.gif',
          title: '',
          subtitle: '',
          buttons: []
        }
      ],
      delay: 2000
    },
    {
      type: 'typingIndicator',
      delay: 2000
    },
    {
      type: 'message',
      sender: 'bot',
      text: 'Scroll down to see my work, or jump straight to the about section below.',
      delay: 1500
    },
    {
      type: 'quickReplies',
      replies: [
        { text: 'About', url: '#scroll-to-about', target: '' }
      ],
      delay: 1500
    }
  ]
};
