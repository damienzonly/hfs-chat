"use strict";{
    const { h } = HFS;
    const { useState, useEffect, useRef, Fragment: frag } = HFS.React;

    HFS.onEvent('afterList', () => h(ChatApp));

    const props = {
        form(m, sm) {
            return {
                async onSubmit(e) {
                    e.preventDefault();
                    await fetch('/~/api/chat/add', {
                        'Content-Type': 'application/json',
                        method: 'POST',
                        body: JSON.stringify({ m })
                    });
                    sm('');
                }
            };
        },
        input(m, sm) {
            return {
                value: m,
                onChange(e) {
                    sm(e.target.value);
                },
            };
        },
    };

    function ChatMessage({ message }) {
        const { u, m, ts } = message;
        return h('div', { className: 'msg' },
            h('div', { className: 'msg-ts' }, new Date(ts).toLocaleString()),
            `${u || '[anon]'} - ${m}`
        );
    }

    function ChatContainer({ messages: ms }) {
        const [m, sm] = useState('');
        const [collapsed, sc] = useState(HFS.misc.tryJson(localStorage.chatCollapsed) ?? true);
        localStorage.chatCollapsed = JSON.stringify(collapsed)
        const ref = useRef()
        const [goBottom, setGoBottom] = useState(true)
        const {current: el} = ref
        useEffect(() => {
            if (el && goBottom)
                el.scrollTo(0, el.scrollHeight)
        }, [goBottom, ms, el])
        useEffect(() => HFS.domOn('scroll', () =>
            setGoBottom(el.scrollTop + el.clientHeight >= el.scrollHeight - 1), { target: el }),
            [el])
        return h('div', { className: 'chat-container' },
            h('div', { className: 'chat-header' }, 'Chat',
                HFS.iconBtn(collapsed ? '▲' : '▼', () => sc(x => !x), { title: HFS.t("collapse/expand") })),
            !collapsed && h('div', { className: 'chat-messages', ref },
                ms.map((message, i) => h(ChatMessage, { key: i, message }))
            ),
            !collapsed && h('form', props.form(m, sm), h('input', props.input(m, sm)))
        );
    }

    function ChatApp() {
        const [msgs, sm] = useState([]);
        async function load() {
            sm(await fetch('/~/api/chat/list').then(v => v.json()).then(v => HFS._.map(v, (o,ts) => Object.assign(o, {ts}))));
        }
        useEffect(() => {
            const eventSource = HFS.getNotifications('chat', (e, data) => {
                if (e !== 'newMessage') return;
                sm(old => [...old, data]);
            });
            load();
            return () => {
                eventSource.then(v => v.close());
            };
        }, []);
        return h(ChatContainer, { messages: msgs });
    }
}
