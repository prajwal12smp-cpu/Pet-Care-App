const API_KEY = 'Your_API';
const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

const chatMessage = document.getElementById('chat-message');
const userInput = document.getElementById('user-input');
const sendButton = document.getElementById('sendbtn');


async function generateResponse(prompt){
    const response = await fetch (`${API_URL}?key=${API_KEY}`, {
        method:'POST',
        headers:{
            'Content-Type':'application/json',
        },
        body:JSON.stringify({
            contents:[
                {
                    parts:[
                        {
                            text:prompt
                        }
                    ]
                }
            ]
        })
    })
    if(!response.ok){
        throw new Error('Failed to run the response');
    }
    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
}

// This function will handle the formatting
function formatMessage(message) {
    // Replace newlines with <br> tags
    let formattedMessage = message.replace(/\n/g, '<br>');

    formattedMessage = formattedMessage.replace(/^(-|\*)\s/gm, '<li>');
    
    // Convert **bold** markdown to <strong> HTML tags
    formattedMessage = formattedMessage.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Handle markdown bullet points (*, -) by converting them to list items
    formattedMessage = formattedMessage.replace(/^(-|\*)\s/gm, '<li>');
    
    // Wrap the list items in a <ul> if they exist
    if (formattedMessage.includes('<li>')) {
        formattedMessage = `<ul>${formattedMessage}</ul>`;
    }

    return formattedMessage;
}

function addMessage(message, isUser) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message');
    messageElement.classList.add(isUser ? 'user-message' : 'bot-message');

    const messageContent = document.createElement('div');
    messageContent.classList.add('message-content');
    
    // Check if the message is from the bot before formatting
    if (isUser) {
        messageContent.textContent = message;
    } else {
        // Use innerHTML to render the formatted HTML from the bot
        messageContent.innerHTML = formatMessage(message); 
    }
    
    messageElement.appendChild(messageContent);
    chatMessage.appendChild(messageElement);
    chatMessage.scrollTop = chatMessage.scrollHeight;
}

async function handleUserInput() {
    const userMessage=userInput.value.trim();

    if(userMessage){
        addMessage(userMessage,true)
    
        userInput.value=''

        sendButton.disabled= true;
        userInput.disabled=true;
    }

    try{
        const botMessage= await generateResponse(userMessage);
        addMessage(botMessage,false);   
    }catch(error){
        console.error(error);
        addMessage('Sorry cannot give response, please try later',false);
    }
    finally{
        sendButton.disabled=false;
        userInput.disabled=false;
        userInput.focus();
    }
}

sendButton.addEventListener('click',handleUserInput);

userInput.addEventListener('keypress',(e)=>{
    if(e.key==='Enter' && !e.shiftKey){
        e.preventDefault();
        handleUserInput();
    }
});
