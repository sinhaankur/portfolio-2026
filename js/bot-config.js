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
      text: 'Hello! I am <b>Ankur</b>. Principal UX Designer focused on <b>agentic workflows</b> and human–AI interaction.',
      delay: 1500
    },
    {
      type: 'typingIndicator',
      delay: 1000
    },
    {
      type: 'message',
      sender: 'bot',
      text: 'By day I lead design at Oracle on cloud DB tooling. On the side I ship the <b>Sentinel / Recourse / Helm</b> trilogy — code prototypes of how humans stay in the loop with AI.',
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
        { text: 'See the trilogy', url: 'https://github.com/sinhaankur/Probabilistic-UI', target: '_blank' },
        { text: 'About', url: '#scroll-to-about', target: '' }
      ],
      delay: 1500
    }
  ]
};
