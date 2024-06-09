const { h } = HFS;
const { useState, useEffect, Fragment: frag } = HFS.React;

HFS.onEvent('afterList', () => h(ChatApp));

const CONTRAST = 'var(--button-bg)'

const props = {
    msg: { style: { padding: 5 } },
    card: {
        style: {
            position: 'fixed',
            width: 600,
            height: 400,
            border: `1px solid ${CONTRAST}`,
            bottom: 10,
            right: 10,
            borderRadius: 3,
            display: 'flex',
            flexDirection: 'column',
        }
    },
    body: {
        style: {
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'scroll',
        },
    },
    form(m, sm) {
        return {
            style: {
                bottom: 0,
                display: 'flex',
                padding: 5,
                borderTop: `1px solid ${CONTRAST}`
            },
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
            style: {
                flex: 1,
                padding: 5,
                border: `1px solid ${CONTRAST}`,
                borderRadius: 3,
                marginRight: 5,
            }
        };
    },
    header: {
        style: {
            borderBottom: `1px solid ${CONTRAST}`,
            fontWeight: 'bold',
            fontSize: 20,
            padding: 5
        }
    },
};

function ChatMessage({ message }) {
    const { u, m, key: ts } = message;
    return h('div', props.msg, `${new Date(ts).toLocaleString()} ${u || '[anon]'} - ${m}`);
}

function ChatContainer({ messages: ms }) {
    const [m, sm] = useState('');
    const mlist = ms.map((message, i) => h(ChatMessage, { key: i, message }));

    const chatMessages = h('div', props.card,
        h('div', props.header, 'Chat'),
        h('div',
            props.body,
            mlist
        ),
        h('form', props.form(m, sm), h('input', props.input(m, sm)))
    );
    return h(frag, null, chatMessages);
}

function ChatApp() {
    const [msgs, sm] = useState([]);
    const [collapsed, sc] = useState(); // todo
    async function load() {
        sm(await fetch('/~/api/chat/list').then(v => v.json()));
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