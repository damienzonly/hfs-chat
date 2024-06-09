const { h } = HFS;
const { useState, useEffect, Fragment: frag } = HFS.React;

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
    const mlist = ms.map((message, i) => h(ChatMessage, { key: i, message }));

    const chatMessages = h('div', { className: 'chat-container' },
        h('div', { className: 'chat-header' }, 'Chat'),
        h('div', { className: 'chat-messages' }, mlist),
        h('form', props.form(m, sm), h('input', props.input(m, sm)))
    );
    return h(frag, null, chatMessages);
}

function ChatApp() {
    const [msgs, sm] = useState([]);
    const [collapsed, sc] = useState(); // todo
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

/**
 * todo:
 * - auto scroll bottom
 * - theme based colors
 * - collapsible
 */