(function() {
    'use strict';

    const responses = {
        'hello': 'Hello! How can I assist you?',
        'name': 'My name is Ankur AI. What can I do for you?',
        'bye': 'Goodbye! Have a great day!'
        // Add more rules and responses as needed
    };

    function processMessage(message) {
        message = message.toLowerCase();
        for (const keyword in responses) {
            if (message.includes(keyword)) {
                return responses[keyword];
            }
        }
        return " I'm not sure how to respond to that.";
    }

    $(function() {
        $('.chat-input').on('keydown', function(e) {
            if (e.keyCode === 13) {
                e.preventDefault();
                const userInput = $(this).val();
                $(this).val('');

                const userMessage = $('<div class="message user">').text(userInput);
                $('.chat-container').append(userMessage);

                const botResponse = processMessage(userInput);
                const botMessage = $('<div class="message bot">').text(botResponse);
                $('.chat-container').append(botMessage);
            }
        });
    });
})();
<script src="https://code.jquery.com/jquery-3.6.4.min.js"></script>