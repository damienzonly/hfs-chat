exports.version = 1
exports.description = "Simple chat integrated in HFS"
exports.apiRequired = 8.65
exports.repo = "damienzonly/hfs-chat"
exports.frontend_js = ['main.js']
exports.frontend_css = ['style.css']
// todo: spam for anon
exports.config = {
    anonWrite: {
        type: 'boolean',
        sm: 6,
        label: 'Anonymous can send',
        helperText: 'Allow anonymous users to send chat messages',
        defaultValue: false
    },
    anonRead: {
        type: 'boolean',
        sm: 6,
        label: 'Anonymous can view',
        helperText: 'Allow anonymous users to view chat messages',
        defaultValue: false
    },
    spamTimeout: {
        type: 'number',
        label: 'Seconds delay for allowing another message to be sent',
        helperText: 'This helps prevent spam',
        min: 0,
        max: 300,
        defaultValue: 0,
    },
    retainMessages: {
        label: 'How many messages to retain',
        defaultValue: 1000,
        sm: 6,
        type: 'number',
        min: 0,
        max: 10000
    },
    maxMsgLen: {
        type: 'number',
        min: 1,
        max: 500,
        sm: 6,
        defaultValue: 280,
        label: 'Maximum number of characters allowed per message'
    },
    bannedUsers: {
        type: 'select',
        fields: {
            user: {
                type: 'username'
            }
        }
    }
}

exports.init = async api => {
    const db = await api.openDb('chat')
    const { getCurrentUsername } = api.require('./auth')
    const API_BASE = `${api.Const.API_URI}chat/`
    const apis = {
        add: `${API_BASE}add`,
        list: `${API_BASE}list`,
    }
    async function listMsg({ ctx, method }) {
        if (method !== 'get') return
        const username = getCurrentUsername(ctx)
        if (!username && !api.getConfig('anonRead')) {
            ctx.status = 403
            return ctx.stop()
        }
        ctx.body = await db.asObject()
        ctx.status = 200
        return ctx.stop()
    }

    function addMsg({ ctx, ts, method }) {
        if (method !== 'post') {
            ctx.status = 400
            return ctx.stop()
        }
        const u = getCurrentUsername(ctx)
        if (!u && !api.getConfig('anonWrite')) {
            ctx.status = 403
            return ctx.stop()
        }
        const { m } = ctx.state.params
        if (!m || typeof m !== 'string' || m?.length > api.getConfig('maxMsgLen')) {
            ctx.status = 400
            return ctx.stop()
        }
        db.put(ts, { m, u })
        api.notifyClient('chat', 'newMessage', { key: ts, u, m })
        ctx.status = 201
    }
    return {
        async middleware(ctx) {
            if (!ctx.path.startsWith(API_BASE)) return
            const ts = new Date().toISOString()
            const p = ctx.path.toLowerCase()
            const method = ctx.method.toLowerCase()
            if (!Object.values(apis).includes(p)) return // api not destined to chat
            if (p === apis.add) await addMsg({ ctx, ts, method });
            else if (p === apis.list) await listMsg({ ctx, method })
        },
    }
}