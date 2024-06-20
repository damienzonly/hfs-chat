# HFS Chat

Welcome to HFS Chat!
<br>
This plugin enables a chat system to let users chat on your HFS server.

![](https://github.com/damienzonly/hfs-chat/assets/38798780/af21cdd8-32b9-4e33-8c84-eeca93152adc)

## Core Features

![options](https://github.com/damienzonly/hfs-chat/assets/38798780/ead05dfe-ea27-4476-b286-ab7ad2b43998)

- **Anonymous Chat**: Users can chat anonymously with configurable send and receive permissions.
- **Spam Prevention**: Implement time delays between messages to prevent spam from the same IP/user.
- **Message Limit**: Set a maximum number of messages to be stored in the database.
- **Ban Management**: Maintain a list of banned users who are restricted from accessing the chat.
- **Character limit**: Limit the maximum allowed characters per message to ensure concise communication.

## Styling
The chat design inherits the style from the standard theme CSS, ensuring a consistent look and feel. All CSS classes are defined in the `style.css` file. If you want to customize the style, you can edit this file directly or create a new plugin to override the CSS rules of the chat plugin.

In addition to the `.msg` CSS class, every message has an additional class `.msg-anon` for guest's messages and `.msg-user` for logger users messages.

## Contribute
We value your feedback! Please create a github issue for any suggestion or problem you encounter. Your feedback is important to us, and we will consider all ideas to improve the plugin.

Have fun!