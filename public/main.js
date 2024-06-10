"use strict"; {
    const conf = HFS.getPluginConfig()
    const username = HFS.state.username
    const { h } = HFS;
    const { useState, useEffect, useRef, Fragment: frag } = HFS.React;

    HFS.onEvent('afterList', () => h(ChatApp));

    const isBanned = myBan()
    let {anonRead: anonCanRead, anonWrite: anonCanWrite} = conf
    if (username) {
        anonCanRead = true
        anonCanWrite = true
    }
    function myBan() {
        return conf.bannedUsers !== undefined && !!conf.bannedUsers.includes(username)
    }

    function ChatMessage({ message }) {
        const { u, m, ts } = message;
        return h('div', { className: 'msg' },
            h('div', { className: 'msg-ts' }, new Date(ts).toLocaleString()),
            `${u || '[anon]'}: ${m}`
        );
    }

    function ChatContainer({ messages: ms }) {
        const [m, sm] = useState('');
        const [collapsed, sc] = useState(HFS.misc.tryJson(localStorage.chatCollapsed) ?? true);
        localStorage.chatCollapsed = JSON.stringify(collapsed)
        const ref = useRef()
        const [goBottom, setGoBottom] = useState(true)
        const { current: el } = ref
        useEffect(() => {
            if (el && goBottom)
                el.scrollTo(0, el.scrollHeight)
        }, [goBottom, ms, el])
        useEffect(() => {
            if (el)
                HFS.domOn('scroll', () =>
                    setGoBottom(el.scrollTop + el.clientHeight >= el.scrollHeight - 1), { target: el })
        },
            [el])
        return h('div', { className: 'chat-container' },
            h('div', { className: 'chat-header' }, 'Chat',
                HFS.iconBtn(collapsed ? '▲' : '▼', () => sc(x => !x), { title: HFS.t("collapse/expand") })),
            !collapsed && h('div', { className: 'chat-messages', ref },
                anonCanRead ? ms.map((message, i) => h(ChatMessage, { key: i, message })) : 'Anonymous users can\'t view messages'
            ),
            !collapsed && h('form', {
                async onSubmit(e) {
                    e.preventDefault();
                    if (!anonCanWrite) return
                    const trim = m.trim()
                    if (!trim) return
                    await fetch('/~/api/chat/add', { 'Content-Type': 'application/json', method: 'POST', body: JSON.stringify({ m: trim }) });
                    sm('');
                }
            }, h('input', {
                value: m,
                disabled: !anonCanWrite,
                onChange(e) { if (e.target.value.length <= conf.maxMsgLen) sm(e.target.value) },
                placeholder: anonCanWrite ? undefined : 'Anonymous users can\'t send messages'
            }), h('div', {className: 'chat-charcounter', style: {color: m.length === conf.maxMsgLen ? '#fe5757' : undefined}}, `${m.length}/${conf.maxMsgLen}`))
        );
    }

    function ChatApp() {
        const [msgs, sm] = useState([]);
        
        async function load() {
            sm(await fetch('/~/api/chat/list').then(v => v.json()).then(v => HFS._.map(v, (o, ts) => Object.assign(o, { ts }))));
        }
        
        useEffect(() => {
            if (isBanned) return
            if (anonCanRead) {
                const eventSource = HFS.getNotifications('chat', (e, data) => {
                    if (e !== 'newMessage') return;
                    sm(old => [...old, data]);
                });
                load();
                return () => {
                    eventSource.then(v => v.close());
                };
            }
        }, []);
        return isBanned || (!anonCanRead && !anonCanWrite)? null : h(ChatContainer, { messages: msgs, isBanned});
    }
}


/**
 * todo:
 * frontend configs change
 * resizable chat container
 * new messages when not scrolled to bottom and on collapsed, persisted in localstorage
 * users that can write and read
 */