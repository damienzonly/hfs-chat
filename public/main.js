"use strict"; {
    const conf = HFS.getPluginConfig()
    const {username} = HFS.state // NB: this can change at run-time
    const { h } = HFS;
    const { useState, useEffect, useRef, Fragment } = HFS.React;

    HFS.onEvent('afterList', () => h(ChatApp));

    let {anonRead: anonCanRead, anonWrite: anonCanWrite} = conf
    if (username) {
        anonCanRead = true
        anonCanWrite = true
    }

    function ChatMessage({ message }) {
        const { u, m, ts, n } = message;
        return h('div', { className: `msg ${u ? 'msg-user' : 'msg-anon'}` },
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

    function ChatContainer() {
        const {username} = HFS.useSnapState()
        const [m, sm] = useState('');
        // nickname, with local persistence
        const [n, sn] = useState(() => localStorage.chatNick ||= 'U' + Math.random().toString().slice(2,5))
        useEffect(() => { localStorage.chatNick = n }, [n])

        const [collapsed, sc, {get: getCollapsed}] = HFS.misc.useStateMounted(HFS.misc.tryJson(localStorage.chatCollapsed) ?? true);
        localStorage.chatCollapsed = JSON.stringify(collapsed)

        const [msgs, setMsgs] = useState();
        useEffect(() => {
            const eventSource = HFS.getNotifications('chat', (e, data) => {
                if (e !== 'newMessage') return;
                setMsgs(old => [...old, data]);
                if (getCollapsed() || !getGoBottom())
                    setUnread(x => x + 1)
            });
            fetch('/~/api/chat/list').then(v => v.json()).then(v =>
                setMsgs(HFS._.map(v, (o, ts) => Object.assign(o, { ts }))));
            return () => {
                eventSource.then(v => v.close());
            };
        }, []);

        const ref = useRef()
        const lastScrollListenerRef = useRef()
        const [goBottom, setGoBottom,{get:getGoBottom}] = HFS.misc.useStateMounted(true)

        const [unread, setUnread] = useState(0);
        useEffect(() => {
            if (!collapsed && goBottom) setUnread(0) // reset
        }, [collapsed, goBottom])

        useEffect(() => {
            const {current:el} = ref
            if (goBottom)
                el?.scrollTo(0, el.scrollHeight)
        }, [goBottom, msgs, collapsed])

        return h('div', { className: 'chat-container' },
            h('div', { className: 'chat-header' },
                h('span', {},
                    `Chat`,
                    !collapsed && !username && h(Fragment, {},
                        ` as ${n} `,
                        HFS.iconBtn('edit', changeNick, { title: HFS.t("change nickname") }),
                    ),
                    unread > 0 && ` (${unread})`
                ),
                HFS.iconBtn(collapsed ? '▲' : '▼', () => sc(x => !x), { title: HFS.t("collapse/expand") })),
            !collapsed && h('div', {
                className: 'chat-messages',
                ref(el) {
                    ref.current = el
                    // reinstall listener
                    lastScrollListenerRef.current?.()
                    lastScrollListenerRef.current = HFS.domOn('scroll', ({ target: el }) =>
                        setGoBottom(el.scrollTop + el.clientHeight >= el.scrollHeight - 3), { target: el })
                }
            }, anonCanRead ? msgs?.map((message, i) => h(ChatMessage, { key: i, message })) : 'Anonymous users can\'t view messages'),
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
                ref(e) { e?.focus() },
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
        const [isBanned, setIsBanned] = useState(true)
        useEffect(() => {
            fetch('/~/api/chat/banned')
            .then(v => v.json())
            .then(v => setIsBanned(v))
            .catch(e => {
                console.error('server error:', e)
                setIsBanned(true)
            })
        })
        return isBanned || (!anonCanRead && !anonCanWrite)? null : h(ChatContainer);
    }
}


/**
 * todo:
 * frontend configs change
 * resizable chat container
 * new messages when not scrolled to bottom and on collapsed, persisted in localstorage
 * users that can write and read
 * .msg-admin message class if message is from an administrator
 */