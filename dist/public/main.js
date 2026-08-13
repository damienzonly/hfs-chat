"use strict"; {
    const conf = HFS.getPluginConfig()
    const {username} = HFS.state // NB: this can change at run-time
    const { h } = HFS;
    const { useState, useEffect, useRef, Fragment } = HFS.React;
    const API_BASE = HFS.prefixUrl + '/~/api/chat/'

    HFS.onEvent('footer', () => h(ChatApp));

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

    const CONTAINER_CLASS = 'chat-container'
    function ChatContainer() {
        const {username} = HFS.useSnapState()
        const [m, sm] = useState('');
        // nickname, with local persistence
        const [n, sn] = useState(() => localStorage.chatNick ||= 'U' + Math.random().toString().slice(2,5))
        useEffect(() => { localStorage.chatNick = n }, [n])

        let [collapsed, sc, getCollapsed] = HFS.misc.useStateMounted(HFS.misc.tryJson(localStorage.chatCollapsed) ?? true);
        getCollapsed = getCollapsed.get || getCollapsed
        localStorage.chatCollapsed = JSON.stringify(collapsed)

        const [msgs, setMsgs] = useState();
        useEffect(() => {
            const eventSource = HFS.getNotifications('chat', (e, data) => {
                if (e !== 'newMessage') return;
                setMsgs(old => [...old, data]);
                if (getCollapsed() || !getGoBottom())
                    setUnread(x => x + 1)
            });
            fetch(API_BASE + 'list').then(v => v.json()).then(v =>
                setMsgs(HFS._.map(v, (o, ts) => Object.assign(o, { ts }))));
            return () => {
                eventSource.then(v => v.close());
            };
        }, []);

        const ref = useRef()
        const lastScrollListenerRef = useRef()
        let [goBottom, setGoBottom, getGoBottom] = HFS.misc.useStateMounted(true)
        getGoBottom = getGoBottom.get || getGoBottom 
        
        const [unread, setUnread] = useState(0);
        useEffect(() => {
            if (!collapsed && goBottom) setUnread(0) // reset
        }, [collapsed, goBottom])

        useEffect(() => {
            const {current:el} = ref
            if (goBottom)
                el?.scrollTo(0, el.scrollHeight)
        }, [goBottom, msgs, collapsed])
        useStickyHelper()
        return h('div', { className: CONTAINER_CLASS },
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
                    const res = await fetch(API_BASE + 'add', {
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
            fetch(API_BASE + 'banned')
            .then(v => v.json())
            .then(v => setIsBanned(v))
            .catch(e => {
                console.error('server error:', e)
                setIsBanned(true)
            })
        })
        return isBanned || (!anonCanRead && !anonCanWrite)? null : h(ChatContainer);
    }

    // don't overlap with pagination-bar when we are in sticky mode
    function useStickyHelper() {
        useEffect(() => {
            let frame = 0
            let resizeObserver
            const mutationObserver = new MutationObserver(update)
            const stopResize = HFS.domOn('resize', update, { target: window })
            mutationObserver.observe(document.body, { childList: true, subtree: true })
            update()
            return () => {
                cancelAnimationFrame(frame)
                stopResize?.()
                mutationObserver.disconnect()
                resizeObserver?.disconnect()
                const paging = document.getElementById('paging')
                if (paging) paging.style.bottom = ''
            }

            function update() {
                frame ||= requestAnimationFrame(() => {
                    frame = 0
                    const chat = document.querySelector('.'+CONTAINER_CLASS)
                    const paging = document.getElementById('paging')
                    if (!paging) return
                    if (!chat) {
                        paging.style.bottom = ''
                        return
                    }
                    const { position } = getComputedStyle(chat)
                    // use the applied css position as source of truth, so js doesn't duplicate media-query rules
                    const shouldOffsetPaging = position === 'sticky'
                    paging.style.bottom = shouldOffsetPaging ? Math.ceil(chat.getBoundingClientRect().height) + 'px' : ''
                    resizeObserver?.disconnect()
                    if (window.ResizeObserver) {
                        resizeObserver = new ResizeObserver(update)
                        resizeObserver.observe(chat)
                        resizeObserver.observe(paging)
                    }
                })
            }

        }, [])
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
