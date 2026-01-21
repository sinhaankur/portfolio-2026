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
      text: 'Scroll down for my work or here are some quick links for you!',
      delay: 1500
    },
    {
      type: 'quickReplies',
      replies: [
        { text: 'Learning', url: '#scroll-to-work', target: '' },
        { text: 'Medium Article', url: 'https://medium.com/@sinhaankur827', target: '_blank' },
        { text: 'LinkedIn', url: 'https://www.linkedin.com/in/sinhaankur27/', target: '_blank' }
      ],
      delay: 1500
    }
  ]
};
