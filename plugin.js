exports.version = 1
exports.description = "Simple chat integrated in HFS"
exports.apiRequired = 8.87
exports.repo = "damienzonly/hfs-chat"
exports.frontend_js = ['main.js']
exports.frontend_css = ['style.css']
exports.config = {
    anonWrite: {
        type: 'boolean',
        sm: 6,
        label: 'Anonymous can send',
        helperText: 'Allow anonymous users to send chat messages',
        defaultValue: false,
        frontend: true
    },
    anonRead: {
        type: 'boolean',
        sm: 6,
        label: 'Anonymous can view',
        helperText: 'Allow anonymous users to view chat messages',
        defaultValue: false,
        frontend: true
    },
    spamTimeout: {
        type: 'number',
        label: 'Seconds delay for allowing another message to be sent',
        helperText: 'This helps prevent spam',
        min: 0,
        max: 300,
        defaultValue: 0,
        frontend: true
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
        label: 'Maximum number of characters allowed per message',
        frontend: true
    },
    bannedUsers: {
        type: 'username',
        multiple: true,
        label: 'Banned users',
        helperText: 'Banned users can\'t access the chat',
        frontend: true
    }
}

exports.init = async api => {
    const chatDb = await api.openDb('chat', { rewriteLater: true })
    const throttleDb = await api.openDb('throttle', { rewriteLater: true })
    const { getCurrentUsername } = api.require('./auth')
    const API_BASE = `${api.Const.API_URI}chat/`
    const apis = {
        add: `${API_BASE}add`,
        list: `${API_BASE}list`,
        banned: `${API_BASE}banned`
    }

    /**
     * @param {string} username 
     * @param {'read' | 'write'} acion 
     * @returns 
     */
    function isAllowed(username, action = 'read') {
        const key = action === 'read' ? 'anonRead' : 'anonWrite'
        if (!username && !api.getConfig(key)) return false
        return !!username && isBanned(username)
    }
    async function listMsg({ ctx, method }) {
        if (method !== 'get') return
        const username = getCurrentUsername(ctx)
        if (isAllowed(username, 'read')) {
            ctx.status = 403
            return ctx.stop()
        }
        ctx.body = await chatDb.asObject()
        ctx.status = 200
        return ctx.stop()
    }

    function isBanned(username) {
        return !!(api.getConfig('bannedUsers') || []).find(u => u === username)
    }

    async function addMsg({ ctx, ts, method }) {
        if (method !== 'post') {
            ctx.status = 400
            return ctx.stop()
        }
        const u = getCurrentUsername(ctx) || undefined
        if (isAllowed(u, 'write')) {
            ctx.status = 403
            return ctx.stop()
        }
        const { m, n } = ctx.state.params
        if (!m || typeof m !== 'string' || m?.length > api.getConfig('maxMsgLen')) {
            ctx.status = 400
            return ctx.stop()
        }
        const who = u ? u : ctx.ip
        const last = await throttleDb.get(who)
        if (last && last + api.getConfig('spamTimeout') * 1000 > Date.now()) {
            ctx.status = 429
            return ctx.stop()
        }
        throttleDb.put(who, Date.now())
        chatDb.put(ts, { m, u, n })
        api.notifyClient('chat', 'newMessage', { ts, u, m, n })
        ctx.status = 201
        const max = api.getConfig('retainMessages')
        while (max && chatDb.size() > max)
            chatDb.del(chatDb.firstKey())
    }
    async function checkBanned({ctx, method}) {
        if (method !== 'get') {
            ctx.status = 400
            return ctx.stop()
        }
        const u = getCurrentUsername(ctx)
        ctx.body = isAllowed(u, 'read') && isAllowed(u, 'write')
        ctx.status = 200
        return ctx.stop()
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
            else if (p === apis.banned) await checkBanned({ctx, method})
        }
    }
}
