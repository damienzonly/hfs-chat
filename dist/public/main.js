{
    let keepDown = true
    function msgEl(_m) {
        const mess = document.createElement('div')
        mess.innerHTML = `<span>${new Date(_m.key).toLocaleString()} - ${_m.u}: ${_m.m}</span>`
        mess.setAttribute('class', 'chat-message')
        return mess
    }

    function onViewerScroll() {
        keepDown = chatViewer.scrollTop >= (chatViewer.scrollHeight - chatViewer.offsetHeight)
    }
    const chatViewer = document.createElement('div')
    chatViewer.setAttribute('id', 'chat-viewer')
    chatViewer.setAttribute('onscroll', 'onViewerScroll()')
    
    const chatContainer = document.createElement('div')
    chatContainer.setAttribute('id', 'chat-container')
    chatViewer.appendChild(chatContainer)

    // chatViewer.style.display = 'none'
    document.body.appendChild(chatViewer)

    fetch('/~/api/chat/list').then(v => v.json()).then(m => {
        for (const _m of m) {
            chatContainer.appendChild(msgEl(_m))
        }
        chatViewer.scrollTop = chatViewer.scrollHeight;
    }).then(() => {
        setInterval(() => {
            if (keepDown)
                chatViewer.scrollTop = chatViewer.scrollHeight;
        }, 100);
    })
}