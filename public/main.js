"use strict"; {
    const conf = HFS.getPluginConfig()
    const {username} = HFS.state // NB: this can change at run-time
    const { h } = HFS;
    const { useState, useEffect, useRef, Fragment } = HFS.React;

    HFS.onEvent('afterList', () => h(ChatApp));

    const isBanned = conf.bannedUsers !== undefined && !!conf.bannedUsers.includes(username)
    let {anonRead: anonCanRead, anonWrite: anonCanWrite} = conf
    if (username) {
        anonCanRead = true
        anonCanWrite = true
    }

    function ChatMessage({ message }) {
        const { u, m, ts, n } = message;
        return h('div', { className: 'msg' },
            h('div', { className: 'msg-ts' }, new Date(ts).toLocaleString()),
            `${u || n && `${n} (guest)` || '[anon]'}: ${m}`
        );
    }
    
    function httpCodeToast(status) {
        const msg = {
            403: 'Forbidden',
            400: 'Invalid Request',
            429: `Can only send one message every ${conf.spamTimeout} seconds`
        }[status]
        msg && HFS.toast(msg, 'error')
    }

    function ChatContainer({ messages: ms }) {
        const {username} = HFS.useSnapState()
        const [m, sm] = useState('');
        // nickname, with local persistence
        const [n, sn] = useState(() => localStorage.chatNick ||= 'U' + Math.random().toString().slice(2,5))
        useEffect(() => { localStorage.chatNick = n }, [n])
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
        }, [el])
        return h('div', { className: 'chat-container' },
            h('div', { className: 'chat-header' },
                h('span', {},
                    `Chat`,
                    !collapsed && !username && h(Fragment, {},
                        ` as ${n} `,
                        HFS.iconBtn('edit', changeNick, { title: HFS.t("change nickname") }),
                    ),
                ),
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
                    const res = await fetch('/~/api/chat/add', {
                        'Content-Type': 'application/json',
                        method: 'POST',
                        body: JSON.stringify({ n: username ? undefined : n, m: trim })
                    })
                    httpCodeToast(res.status)
                    if (res.status >= 200 && res.status < 300)
                        sm('');
                }
            }, h('input', {
                value: m,
                disabled: !anonCanWrite,
                onChange(e) { if (e.target.value.length <= conf.maxMsgLen) sm(e.target.value) },
                placeholder: anonCanWrite ? undefined : 'Anonymous users can\'t send messages'
            }), h('div', {className: 'chat-charcounter', style: {color: m.length === conf.maxMsgLen ? '#fe5757' : undefined}}, `${m.length}/${conf.maxMsgLen}`))
        );

        function changeNick() {
            HFS.dialogLib.promptDialog("Your name", { value: n }).then(x => x && sn(x))
        }
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
 * don't send banned users list to frontend
 */